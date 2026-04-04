import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { generateAiJson } from "@/lib/ai";
import { getUserBrand, type BrandAiEnrichment } from "@/lib/get-user-brand";
import { getCompanyByVat } from "@/lib/cvr-api";
import { checkEntitlement, checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";
import { db } from "@/db";
import { userBrand } from "@/db/schema";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed } = await checkEntitlement(session.user.id, "aiFeatures");
    if (!allowed) {
      return NextResponse.json(
        { error: "AI features require a paid plan", upgrade: true },
        { status: 403 }
      );
    }

    const quota = await checkMonthlyQuota(session.user.id, "ai_usage");
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `AI usage limit reached (${quota.used}/${quota.limit}). Upgrade for more.`, upgrade: true },
        { status: 403 }
      );
    }

    const brand = await getUserBrand(session.user.id);
    if (!brand) {
      return NextResponse.json({ error: "Save your company profile first" }, { status: 400 });
    }

    const { answers, locale = "en" } = await req.json();
    const lang = locale === "da" ? "Danish" : "English";

    // Try to fetch CVR data for additional context
    let cvrContext = "";
    if (brand.cvr && /^\d{8}$/.test(brand.cvr)) {
      try {
        const company = await getCompanyByVat(Number(brand.cvr));
        const accounting = company.accounting?.documents?.[0]?.summary;
        cvrContext = `
CVR DATA:
- Founded: ${company.life?.start ?? "Unknown"}
- Company form: ${company.companyform?.longdescription ?? company.companyform?.description ?? "Unknown"}
- Status: ${company.companystatus?.text ?? "Unknown"}
- Address: ${[company.address?.street, company.address?.zipcode, company.address?.cityname].filter(Boolean).join(", ")}
- Purpose: ${company.info?.purpose ?? "Not stated"}
- Revenue: ${accounting?.revenue != null ? `${accounting.revenue} DKK` : "N/A"}
- Profit: ${accounting?.profitloss != null ? `${accounting.profitloss} DKK` : "N/A"}
- Equity: ${accounting?.equity != null ? `${accounting.equity} DKK` : "N/A"}
- Employees (accounting): ${accounting?.averagenumberofemployees ?? "N/A"}`;
      } catch {
        // CVR lookup failed — proceed without it
      }
    }

    // Format user's answers
    const answersText = Array.isArray(answers) && answers.length > 0
      ? answers
          .filter((a: { answer?: string }) => a.answer?.trim())
          .map((a: { question?: string; answer?: string }, i: number) => `Q${i + 1}: ${a.question ?? "?"}\nA: ${a.answer}`)
          .join("\n\n")
      : "No additional answers provided.";

    const systemPrompt = `You are a B2B brand strategist. Analyze the company data and the founder/team's own answers to generate a comprehensive brand profile. Be specific, actionable, and data-driven. Always respond in ${lang}.`;

    const userPrompt = `Generate a brand enrichment profile for this company using their profile data, CVR records, and their own answers to strategic questions.

COMPANY PROFILE:
- Name: ${brand.companyName}
- Industry: ${brand.industry ?? "Not specified"}
- Products/Services: ${brand.products}
- Target Audience: ${brand.targetAudience ?? "Not specified"}
- Company Size: ${brand.companySize ?? "Not specified"}${brand.employees ? ` (~${brand.employees} employees)` : ""}
- Website: ${brand.website ?? "N/A"}
${cvrContext}

FOUNDER/TEAM ANSWERS:
${answersText}

Respond with a JSON object containing ALL of these fields:
- "description": 2-3 sentence company description — what they do, their market position, and what makes them notable
- "valueProposition": 1-2 sentences on what makes this company uniquely valuable to customers
- "messagingPoints": Array of 3-5 key messaging themes for sales outreach (specific, not generic)
- "painPointsSolved": Array of 3-5 specific customer pain points this company solves
- "competitiveAdvantages": Array of 3-5 concrete differentiators vs alternatives
- "idealCustomerProfile": 2-3 sentences describing their ideal customer (industry, company size, role of buyer, buying triggers)
- "pricingModel": Their pricing approach (e.g. "SaaS subscription with per-seat pricing", "Project-based consulting")
- "geographicFocus": Primary geographic markets (e.g. "Denmark and Nordics", "Global with EU focus")

Use their own words and answers as the primary source. Supplement with CVR data where relevant. Be specific — avoid generic statements like "they provide great service."`;

    const raw = await generateAiJson<Record<string, unknown>>({
      model: "gemini-2.5-flash",
      systemPrompt,
      userPrompt,
      maxTokens: 2048,
    });

    // Flatten nested wrapper
    const topKeys = Object.keys(raw);
    let data = raw;
    if (topKeys.length === 1 && typeof raw[topKeys[0]] === "object" && raw[topKeys[0]] !== null) {
      data = raw[topKeys[0]] as Record<string, unknown>;
    }

    const enrichment: BrandAiEnrichment = {
      description: String(data.description ?? data.Description ?? ""),
      valueProposition: String(data.valueProposition ?? data.value_proposition ?? data.ValueProposition ?? ""),
      messagingPoints: (Array.isArray(data.messagingPoints) ? data.messagingPoints : Array.isArray(data.messaging_points) ? data.messaging_points : []) as string[],
      painPointsSolved: (Array.isArray(data.painPointsSolved) ? data.painPointsSolved : Array.isArray(data.pain_points_solved) ? data.pain_points_solved : []) as string[],
      competitiveAdvantages: (Array.isArray(data.competitiveAdvantages) ? data.competitiveAdvantages : Array.isArray(data.competitive_advantages) ? data.competitive_advantages : []) as string[],
      idealCustomerProfile: String(data.idealCustomerProfile ?? data.ideal_customer_profile ?? data.IdealCustomerProfile ?? ""),
      pricingModel: String(data.pricingModel ?? data.pricing_model ?? data.PricingModel ?? ""),
      geographicFocus: String(data.geographicFocus ?? data.geographic_focus ?? data.GeographicFocus ?? ""),
      generatedAt: new Date().toISOString(),
    };

    if (!enrichment.description) {
      return NextResponse.json({ error: "AI returned empty enrichment" }, { status: 500 });
    }

    // Save to DB
    await db
      .update(userBrand)
      .set({ aiEnrichment: enrichment })
      .where(eq(userBrand.userId, session.user.id));

    await recordUsage(session.user.id, "ai_usage");

    return NextResponse.json({ aiEnrichment: enrichment });
  } catch (error) {
    console.error("Brand enrichment error:", error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate enrichment" },
      { status: 500 }
    );
  }
}
