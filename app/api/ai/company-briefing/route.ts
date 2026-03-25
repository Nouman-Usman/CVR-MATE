import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCompanyByVat } from "@/lib/cvr-api";
import { generateAiJson } from "@/lib/ai";
import { cacheGet, cacheSet } from "@/lib/redis";
import { cacheKey, CACHE_TTL } from "@/lib/cache";
import { getUserBrand, formatBrandContext } from "@/lib/get-user-brand";

interface BriefingResponse {
  briefing: string;
  keyInsights: string[];
  suggestedApproach: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { vat, locale = "en" } = await req.json();

    if (!vat || !/^\d{8}$/.test(String(vat))) {
      return NextResponse.json(
        { error: "Valid 8-digit CVR number is required" },
        { status: 400 }
      );
    }

    // Check cache (include userId to separate brand-personalized results)
    const key = cacheKey.aiBriefing(String(vat), locale) + `:${session.user.id}`;
    const cached = await cacheGet<BriefingResponse>(key);
    if (cached) return NextResponse.json(cached);

    // Fetch company data and user brand
    const [company, brand] = await Promise.all([
      getCompanyByVat(Number(vat)),
      getUserBrand(session.user.id),
    ]);

    const accounting = company.accounting?.documents?.[0]?.summary;
    const employmentHistory = company.employment?.years?.slice(0, 5) ?? [];
    const participants = company.participants ?? [];

    const lang = locale === "da" ? "Danish" : "English";

    const brandNote = brand ? ` Tailor insights to be relevant for a company that sells "${brand.products}"${brand.targetAudience ? ` to ${brand.targetAudience}` : ""}.` : "";
    const systemPrompt = `You are a B2B sales intelligence analyst specializing in Danish companies. You produce concise, actionable briefings for sales professionals. Always respond in ${lang}. Be specific and data-driven. Focus on what matters for a salesperson preparing for outreach.${brandNote}`;

    const userPrompt = `Analyze this Danish company and produce a sales briefing:

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
- Revenue: ${accounting?.revenue != null ? `${accounting.revenue} DKK` : "Not available"}
- Gross Profit: ${accounting?.grossprofitloss != null ? `${accounting.grossprofitloss} DKK` : "N/A"}
- Profit/Loss: ${accounting?.profitloss != null ? `${accounting.profitloss} DKK` : "N/A"}
- Equity: ${accounting?.equity != null ? `${accounting.equity} DKK` : "N/A"}
- Total Assets: ${accounting?.assets != null ? `${accounting.assets} DKK` : "N/A"}
- Avg Employees (accounting): ${accounting?.averagenumberofemployees ?? "N/A"}

EMPLOYMENT HISTORY (last 5 years):
${employmentHistory.length > 0 ? employmentHistory.map(e => `  ${e.year}: ${e.amount ?? "N/A"} employees (range: ${e.interval_low ?? "?"}-${e.interval_high ?? "?"})`).join("\n") : "No data"}

KEY PEOPLE:
${participants.length > 0 ? participants.map(p => `  - ${p.life.name} | Role: ${p.roles?.life?.title ?? p.roles?.type ?? "Unknown"} | Profession: ${p.life.profession ?? "N/A"}`).join("\n") : "No participant data"}

CONTACT:
- Email: ${company.contact?.email ?? "N/A"}
- Phone: ${company.contact?.phone ?? "N/A"}
- Website: ${company.contact?.www ?? "N/A"}

Respond with a JSON object containing:
- "briefing": A 3-4 paragraph natural-language analysis covering: what the company does, financial health, growth signals, and notable characteristics. Be specific with numbers.
- "keyInsights": An array of 3-5 short bullet points highlighting the most important findings for a salesperson (each under 100 chars).
- "suggestedApproach": A short paragraph (2-3 sentences) recommending how to approach this company, who to contact, and what angle to use.

${formatBrandContext(brand)}`;

    const raw = await generateAiJson<Record<string, unknown>>({
      model: "gemini-2.5-flash",
      systemPrompt,
      userPrompt,
      maxTokens: 2048,
    });

    // Normalize — Gemini may vary key casing
    const result: BriefingResponse = {
      briefing: (raw.briefing ?? raw.Briefing ?? raw.analysis ?? "") as string,
      keyInsights: (raw.keyInsights ?? raw.key_insights ?? raw.insights ?? raw.KeyInsights ?? []) as string[],
      suggestedApproach: (raw.suggestedApproach ?? raw.suggested_approach ?? raw.SuggestedApproach ?? raw.approach ?? "") as string,
    };

    // Cache the result
    await cacheSet(key, result, CACHE_TTL.aiBriefing);

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI briefing error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate briefing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
