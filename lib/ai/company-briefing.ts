import "server-only";

import { generateAiJson } from "@/lib/ai";
import type { CvrCompany } from "@/lib/cvr-api";
import { formatBrandContext, type UserBrand } from "@/lib/get-user-brand";

export interface BriefingResult {
  briefing: string;
  keyInsights: string[];
  suggestedApproach: string;
}

/**
 * Generate a sales briefing for a company. Pure generation — no auth, quota, or
 * persistence (the caller handles those). Shared by the /api/ai/company-briefing
 * route and the search agent's `company_briefing` tool.
 */
export async function generateCompanyBriefing(params: {
  company: CvrCompany;
  locale: string;
  brand: UserBrand | null | undefined;
}): Promise<BriefingResult> {
  const { company, locale, brand } = params;

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

  let raw: Record<string, unknown>;
  try {
    raw = await generateAiJson<Record<string, unknown>>({
      model: "claude-haiku-4-5-20251001",
      systemPrompt,
      userPrompt,
      maxTokens: 4096, // Increased from 2048 for thinking model token budget
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("rate limit") || msg.includes("quota")) {
      throw err;
    }
    console.warn("[Briefing] Generation failed, returning placeholder:", msg.slice(0, 100));
    raw = {
      briefing: "Briefing generation is temporarily unavailable. Please try again in a moment.",
      keyInsights: ["Unable to generate insights at this time. Please retry."],
      suggestedApproach: "Please retry the briefing in a moment.",
    };
  }

  // Flatten nested wrapper if the model wraps in a top-level key
  const topKeys = Object.keys(raw);
  let data = raw;
  if (topKeys.length === 1 && typeof raw[topKeys[0]] === "object" && raw[topKeys[0]] !== null) {
    data = raw[topKeys[0]] as Record<string, unknown>;
  }

  // Normalize — models may vary key casing
  const result: BriefingResult = {
    briefing: String(data.briefing ?? data.Briefing ?? data.analysis ?? "").trim() || "Briefing generation failed. Please try again.",
    keyInsights: (
      Array.isArray(data.keyInsights) ? data.keyInsights
        : Array.isArray(data.key_insights) ? data.key_insights
          : Array.isArray(data.insights) ? data.insights
            : Array.isArray(data.KeyInsights) ? data.KeyInsights
              : []
    ) as string[],
    suggestedApproach: String(data.suggestedApproach ?? data.suggested_approach ?? data.SuggestedApproach ?? data.approach ?? "").trim() || "Please retry the briefing.",
  };

  return result;
}
