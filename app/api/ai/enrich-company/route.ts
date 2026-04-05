import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCompanyByVat, type CvrCompany } from "@/lib/cvr-api";
import { generateAiJson } from "@/lib/ai";
import { getUserBrand, formatBrandContext } from "@/lib/get-user-brand";
import { checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";
import { db } from "@/db";
import { profileEnrichment } from "@/db/schema";
import { cacheSet, cacheDel } from "@/lib/redis";
import { cacheKey, CACHE_TTL } from "@/lib/cache";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quota = await checkMonthlyQuota(session.user.id, "enrichment");
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `AI usage limit reached (${quota.used}/${quota.limit}). Upgrade for more.`, upgrade: true },
        { status: 403 }
      );
    }

    const { vat, locale = "en", companyData } = await req.json();

    if (!vat || !/^\d{8}$/.test(String(vat))) {
      return NextResponse.json(
        { error: "Valid 8-digit CVR number is required" },
        { status: 400 }
      );
    }

    let company: CvrCompany;
    try {
      company = await getCompanyByVat(Number(vat));
    } catch {
      if (companyData) {
        company = companyData as CvrCompany;
      } else {
        throw new Error("Could not fetch company data");
      }
    }

    const brand = await getUserBrand(session.user.id);
    const accounting = company.accounting?.documents?.[0]?.summary;
    const employmentHistory = company.employment?.years?.slice(0, 5) ?? [];
    const participants = company.participants ?? [];
    const lang = locale === "da" ? "Danish" : "English";

    const brandNote = brand
      ? ` The user sells "${brand.products}"${brand.targetAudience ? ` to ${brand.targetAudience}` : ""}. Tailor the lead score and approach to this context.`
      : "";

    const systemPrompt = `You are an elite B2B sales intelligence analyst specializing in Danish companies. You produce comprehensive, data-driven enrichment profiles that help sales teams prioritize leads and craft perfect outreach. Always respond in ${lang}. Be specific with numbers and evidence.${brandNote}`;

    const userPrompt = `Produce a FULL enrichment profile for this Danish company:

COMPANY: ${company.life.name}
CVR: ${company.vat}
STATUS: ${company.companystatus?.text ?? "Unknown"}
COMPANY FORM: ${company.companyform?.longdescription ?? company.companyform?.description ?? "Unknown"}
FOUNDED: ${company.life.start ?? "Unknown"}
INDUSTRY: ${company.industry?.primary?.text ?? "Unknown"} (code: ${company.industry?.primary?.code ?? "N/A"})
SECONDARY INDUSTRIES: ${company.industry?.secondary?.map(s => s.text).join(", ") || "None"}
PURPOSE: ${company.info?.purpose ?? "Not stated"}
ADDRESS: ${[company.address?.street, company.address?.zipcode, company.address?.cityname].filter(Boolean).join(", ")}
MUNICIPALITY: ${company.address?.municipalityname ?? "Unknown"}
CAPITAL: ${company.info?.capital_amount != null ? `${company.info.capital_amount} ${company.info?.capital_currency ?? "DKK"}` : "Not disclosed"}
BANKRUPT: ${company.status?.bankrupt ? "Yes" : "No"}

FINANCIALS:
- Revenue: ${accounting?.revenue != null ? `${accounting.revenue} DKK` : "N/A"}
- Gross Profit: ${accounting?.grossprofitloss != null ? `${accounting.grossprofitloss} DKK` : "N/A"}
- Profit/Loss: ${accounting?.profitloss != null ? `${accounting.profitloss} DKK` : "N/A"}
- Equity: ${accounting?.equity != null ? `${accounting.equity} DKK` : "N/A"}
- Total Assets: ${accounting?.assets != null ? `${accounting.assets} DKK` : "N/A"}
- Avg Employees: ${accounting?.averagenumberofemployees ?? "N/A"}

EMPLOYMENT HISTORY:
${employmentHistory.length > 0 ? employmentHistory.map(e => `  ${e.year}: ${e.amount ?? "N/A"} employees`).join("\n") : "No data"}

KEY PEOPLE:
${participants.length > 0 ? participants.map(p => `  - ${p.life.name} | ${p.roles?.life?.title ?? p.roles?.type ?? "Unknown"} | ${p.life.profession ?? "N/A"}`).join("\n") : "No data"}

CONTACT: Email: ${company.contact?.email ?? "N/A"} | Phone: ${company.contact?.phone ?? "N/A"} | Web: ${company.contact?.www ?? "N/A"}

Respond with a JSON object containing ALL of these fields:
- "summary": 2-3 paragraph business overview — what they do, market position, trajectory. Use specific numbers.
- "leadScore": { "grade": "A" or "B" or "C" or "D", "reason": "1-2 sentence justification" }
  A = High priority (strong financials, growing, good fit)
  B = Good potential (stable, decent size, relevant industry)
  C = Moderate (small, limited data, or unclear fit)
  D = Low priority (declining, bankrupt risk, bad fit)
- "financialHealth": { "status": "growth" or "stable" or "declining", "details": "2-3 sentences explaining with numbers" }
- "buyingSignals": Array of 3-5 strings — positive indicators that suggest this company is ready to buy (e.g. "Hiring 20% more staff", "Revenue grew 15% YoY")
- "painPoints": Array of 3-5 strings — likely business challenges this company faces
- "competitiveLandscape": 1-2 paragraphs about their industry position and competitors
- "riskFactors": Array of 2-4 strings — warnings or concerns (e.g. "Key person dependency", "Single industry exposure")
- "idealApproach": { "channel": "email" or "phone" or "linkedin", "timing": "specific recommendation", "angle": "1-2 sentence messaging strategy" }
- "keyInsights": Array of 4-6 short bullet points — the most important takeaways

${formatBrandContext(brand)}`;

    const raw = await generateAiJson<Record<string, unknown>>({
      model: "gemini-2.5-flash",
      systemPrompt,
      userPrompt,
      maxTokens: 4096,
    });

    // Flatten nested wrapper
    const topKeys = Object.keys(raw);
    let data = raw;
    if (topKeys.length === 1 && typeof raw[topKeys[0]] === "object" && raw[topKeys[0]] !== null) {
      data = raw[topKeys[0]] as Record<string, unknown>;
    }

    // Normalize response
    const enrichment = {
      summary: String(data.summary ?? data.Summary ?? ""),
      leadScore: (data.leadScore ?? data.lead_score ?? data.LeadScore ?? { grade: "C", reason: "" }) as Record<string, unknown>,
      financialHealth: (data.financialHealth ?? data.financial_health ?? data.FinancialHealth ?? { status: "stable", details: "" }) as Record<string, unknown>,
      buyingSignals: (Array.isArray(data.buyingSignals) ? data.buyingSignals : Array.isArray(data.buying_signals) ? data.buying_signals : []) as string[],
      painPoints: (Array.isArray(data.painPoints) ? data.painPoints : Array.isArray(data.pain_points) ? data.pain_points : []) as string[],
      competitiveLandscape: String(data.competitiveLandscape ?? data.competitive_landscape ?? ""),
      riskFactors: (Array.isArray(data.riskFactors) ? data.riskFactors : Array.isArray(data.risk_factors) ? data.risk_factors : []) as string[],
      idealApproach: (data.idealApproach ?? data.ideal_approach ?? data.IdealApproach ?? { channel: "email", timing: "", angle: "" }) as Record<string, unknown>,
      keyInsights: (Array.isArray(data.keyInsights) ? data.keyInsights : Array.isArray(data.key_insights) ? data.key_insights : []) as string[],
    };

    if (!enrichment.summary) {
      return NextResponse.json({ error: "AI returned empty enrichment" }, { status: 500 });
    }

    // Persist to Postgres
    const [saved] = await db
      .insert(profileEnrichment)
      .values({
        userId: session.user.id,
        entityType: "company",
        entityId: String(vat),
        entityName: company.life.name,
        enrichmentData: enrichment,
      })
      .returning();

    // Cache in Redis (24h)
    const rKey = cacheKey.enrichment("company", String(vat), session.user.id);
    await cacheSet(rKey, { ...enrichment, id: saved.id, createdAt: saved.createdAt.toISOString() }, CACHE_TTL.enrichment);

    await recordUsage(session.user.id, "enrichment");

    return NextResponse.json({
      enrichment: { ...enrichment, id: saved.id, createdAt: saved.createdAt.toISOString() },
    });
  } catch (error) {
    console.error("Company enrichment error:", error instanceof Error ? error.stack : error);
    const message = error instanceof Error ? error.message : "Failed to generate enrichment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
