import "server-only";

import { inArray } from "drizzle-orm";
import { generateAiJson } from "@/lib/ai";
import { accountingSummary, getCompanyByVat } from "@/lib/cvr-api";
import { formatBrandContext, type UserBrand } from "@/lib/get-user-brand";
import { db } from "@/db";
import { company as companyTable } from "@/db/schema";

export interface PrioritizedCompany {
  vat: string;
  name: string;
  score: "high" | "medium" | "low";
  reason: string;
}

export interface Segment {
  name: string;
  vats: string[];
  insight: string;
}

export interface NextAction {
  vat: string;
  name: string;
  action: string;
}

export interface PipelineResponse {
  prioritized: PrioritizedCompany[];
  segments: Segment[];
  nextActions: NextAction[];
}

export type PipelineAnalysisOutcome =
  | { ok: true; result: PipelineResponse }
  | { ok: false; reason: "no_companies" };

/**
 * Fetch the given companies (CVR API, DB fallback), summarize, and produce a
 * prioritized pipeline analysis. Pure generation + data-gathering — no auth,
 * quota, or usage recording. Returns `{ ok: false }` when no valid companies
 * resolve (caller maps to 404 / error).
 */
export async function analyzePipeline(params: {
  vats: (string | number)[];
  locale: string;
  brand: UserBrand | null | undefined;
}): Promise<PipelineAnalysisOutcome> {
  const { vats, locale, brand } = params;
  const vatStrings = vats.map(String);

  // Try fetching from CVR API in parallel, fall back to DB for failures
  const cvrResults = await Promise.allSettled(vatStrings.map((vat) => getCompanyByVat(Number(vat))));

  const cvrCompanies = cvrResults
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter(Boolean);

  // For any that failed the CVR API, try the local DB
  const failedVats = vatStrings.filter((_, i) => cvrResults[i].status === "rejected");

  let dbCompanies: { vat: string; name: string; industryName: string | null; city: string | null; employees: number | null; companyStatus: string | null; founded: string | null }[] = [];
  if (failedVats.length > 0) {
    dbCompanies = await db
      .select({
        vat: companyTable.vat,
        name: companyTable.name,
        industryName: companyTable.industryName,
        city: companyTable.city,
        employees: companyTable.employees,
        companyStatus: companyTable.companyStatus,
        founded: companyTable.founded,
      })
      .from(companyTable)
      .where(inArray(companyTable.vat, failedVats));
  }

  // Build company summaries
  const companySummaries: string[] = [];

  for (const c of cvrCompanies) {
    const acc = accountingSummary(c!.accounting?.documents?.[0]);
    const emp = c!.employment?.years?.[0];
    companySummaries.push(
      `- ${c!.life.name} (CVR: ${c!.vat}) | Industry: ${c!.industry?.primary?.text ?? "?"} | City: ${c!.address?.cityname ?? "?"} | Employees: ${emp?.amount ?? acc?.averagenumberofemployees ?? "?"} | Revenue: ${acc?.revenue != null ? `${acc.revenue} DKK` : "?"} | Profit: ${acc?.profitloss != null ? `${acc.profitloss} DKK` : "?"} | Founded: ${c!.life.start ?? "?"} | Status: ${c!.companystatus?.text ?? "?"} | Bankrupt: ${c!.status?.bankrupt ? "Yes" : "No"}`
    );
  }

  for (const c of dbCompanies) {
    companySummaries.push(
      `- ${c.name} (CVR: ${c.vat}) | Industry: ${c.industryName ?? "?"} | City: ${c.city ?? "?"} | Employees: ${c.employees ?? "?"} | Founded: ${c.founded ?? "?"} | Status: ${c.companyStatus ?? "?"}`
    );
  }

  if (companySummaries.length === 0) {
    return { ok: false, reason: "no_companies" };
  }

  const lang = locale === "da" ? "Danish" : "English";

  const brandNote = brand ? ` The user sells: "${brand.products}"${brand.targetAudience ? ` to ${brand.targetAudience}` : ""}. Factor fit with their offering into scoring.` : "";
  const systemPrompt = `You are a B2B sales pipeline analyst. You help sales teams prioritize their saved leads. Always respond in ${lang}. Be data-driven and actionable.${brandNote}`;

  const userPrompt = `Analyze this pipeline of ${companySummaries.length} saved companies and provide prioritization:

COMPANIES:
${companySummaries.join("\n")}

You MUST respond with a JSON object with exactly these keys: "prioritized", "segments", "nextActions".

Example format:
{
  "prioritized": [
    { "vat": "12345678", "name": "Company Name", "score": "high", "reason": "Brief reason for the score (under 80 chars)" }
  ],
  "segments": [
    { "name": "Segment name", "vats": ["12345678"], "insight": "What these companies have in common and why it matters" }
  ],
  "nextActions": [
    { "vat": "12345678", "name": "Company Name", "action": "Specific next step to take" }
  ]
}

RULES:
- "vat" values MUST be strings, not numbers
- "score" MUST be one of: "high", "medium", "low"
- Include ALL companies in the "prioritized" array
- Score based on: financial health (revenue/profit), growth signals (employee growth), company maturity, industry attractiveness, and fit with the seller's target audience
- Bankrupt companies = "low" automatically
- Create 2-4 meaningful segments (by industry, size, growth stage, etc.)
- Suggest 1 specific next action per company in "nextActions"
- Keep all text concise

${formatBrandContext(brand)}`;

  // Scale token budget with company count to avoid truncation
  // For thinking models, multiply by 8x to account for internal reasoning
  const baseTokenBudget = Math.min(8192, 1536 + companySummaries.length * 200);
  const tokenBudget = Math.max(16384, baseTokenBudget * 8);

  let raw: Record<string, unknown>;
  try {
    raw = await generateAiJson<Record<string, unknown>>({
      model: "claude-haiku-4-5-20251001",
      systemPrompt,
      userPrompt,
      maxTokens: tokenBudget,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("rate limit") || msg.includes("quota")) {
      throw err;
    }
    console.warn("[Pipeline Analysis] Generation failed, using fallback:", msg.slice(0, 100));
    // Return minimal fallback analysis from available companies
    const allCompanies = [...cvrCompanies.filter(Boolean), ...dbCompanies];
    raw = {
      prioritized: allCompanies.slice(0, 5).map(c => {
        const company = c as { vat?: string; life?: { name?: string }; name?: string };
        return {
          vat: String(company.vat ?? "unknown"),
          name: company.life?.name ?? company.name ?? "Company",
          score: "medium",
          reason: "Analysis pending. Retry shortly.",
        };
      }),
      segments: [],
      nextActions: allCompanies.slice(0, 3).map(c => {
        const company = c as { vat?: string; life?: { name?: string }; name?: string };
        return {
          vat: String(company.vat ?? "unknown"),
          name: company.life?.name ?? company.name ?? "Company",
          action: "Retry pipeline analysis when available",
        };
      }),
      summary: "Pipeline analysis generation failed. Try again in a moment.",
    };
  }

  // Normalize key casing — AI models sometimes vary casing
  const rawPrioritized = (raw.prioritized ?? raw.Prioritized ?? raw.priorities ?? []) as PrioritizedCompany[];
  const rawSegments = (raw.segments ?? raw.Segments ?? []) as Segment[];
  const rawNextActions = (raw.nextActions ?? raw.next_actions ?? raw.NextActions ?? []) as NextAction[];

  // Sanitize — ensure score values are valid, coerce vat to string
  const validScores = new Set(["high", "medium", "low"]);
  const result: PipelineResponse = {
    prioritized: rawPrioritized.map(p => ({
      vat: String(p.vat),
      name: p.name ?? "",
      score: (validScores.has(p.score) ? p.score : "medium") as "high" | "medium" | "low",
      reason: p.reason ?? "",
    })),
    segments: rawSegments.map(s => ({
      name: s.name ?? "",
      vats: Array.isArray(s.vats) ? s.vats.map(String) : [],
      insight: s.insight ?? "",
    })),
    nextActions: rawNextActions.map(na => ({
      vat: String(na.vat),
      name: na.name ?? "",
      action: na.action ?? "",
    })),
  };

  return { ok: true, result };
}
