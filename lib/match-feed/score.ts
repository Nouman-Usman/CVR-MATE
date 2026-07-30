import "server-only";

import type { ParsedCompany } from "@/lib/cvr-api-elasticsearch";
import { formatBrandContext, type UserBrand } from "@/lib/get-user-brand";
import { generateAiJson } from "@/lib/ai";
import type { MatchPreferences } from "./rank";

export interface MatchScore {
  vat: string;
  score: "high" | "medium" | "low";
  reason: string;
}

const VALID_SCORES = new Set(["high", "medium", "low"]);

/**
 * Build a one-line preferences hint for the LLM, or "" when there is nothing
 * learned yet. Surfaces the industries / regions the user has previously LIKED
 * (positive weight, strongest first) and REJECTED (negative weight).
 */
function summarizePreferences(preferences?: MatchPreferences): string {
  const industry = preferences?.industry ?? {};
  const region = preferences?.region ?? {};
  if (Object.keys(industry).length === 0 && Object.keys(region).length === 0) return "";

  const entries: [string, number][] = [
    ...Object.entries(industry),
    ...Object.entries(region),
  ].filter(([, w]) => typeof w === "number");

  const liked = entries
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
  const rejected = entries.filter(([, w]) => w < 0).map(([k]) => k);

  const likedStr = liked.length ? liked.join(", ") : "none yet";
  const rejectedStr = rejected.length ? rejected.join(", ") : "none yet";

  return `The user has previously LIKED companies in: ${likedStr}; and REJECTED: ${rejectedStr}. Weight accordingly.`;
}

/**
 * One batched Haiku call that scores every candidate for fit with the seller.
 * Never throws: on generation failure every candidate falls back to a neutral
 * "medium" score with a retry note.
 */
export async function scoreMatches(params: {
  candidates: ParsedCompany[];
  brand: UserBrand;
  preferences?: MatchPreferences;
  locale: string;
}): Promise<MatchScore[]> {
  const { candidates, brand, preferences, locale } = params;

  if (candidates.length === 0) return [];

  const lang = locale === "da" ? "Danish" : "English";

  const list = candidates
    .map(
      (c, i) =>
        `${i + 1}. ${c.name} (CVR: ${c.vat}) | Industry: ${c.industry || c.industryCode || "?"} | City: ${c.city || "?"} | Founded: ${c.founded || "?"} | Employees: ${c.employees || "?"}`
    )
    .join("\n");

  const prefsSummary = summarizePreferences(preferences);

  const systemPrompt =
    "You are a B2B sales matching assistant. You judge how well each candidate " +
    `company fits a Danish seller as a potential CUSTOMER. Always respond in ${lang}. ` +
    "Be concise and specific to the seller's offering.";

  const userPrompt = `${formatBrandContext(brand)}${prefsSummary ? `\n\n${prefsSummary}` : ""}

Below are ${candidates.length} candidate companies from the Danish CVR registry.
Score how well EACH fits the seller above as a potential customer.

CANDIDATES:
${list}

Respond with a JSON object of exactly this shape:
{ "matches": [ { "vat": "<cvr>", "score": "high|medium|low", "reason": "<why THIS company fits the seller, under 80 chars>" } ] }

RULES:
- Include ALL ${candidates.length} candidates, one entry each.
- "vat" MUST be a string.
- "score" MUST be one of: "high", "medium", "low".
- "reason" MUST be under 80 characters and specific to the seller's offering.`;

  const maxTokens = Math.max(2048, Math.min(8192, 512 + candidates.length * 120));

  try {
    const raw = await generateAiJson<Record<string, unknown>>({
      model: "claude-haiku-4-5-20251001",
      systemPrompt,
      userPrompt,
      maxTokens,
    });

    // Guard against a non-array `matches` (malformed LLM output) rather than
    // relying on a thrown .map to hit the catch below.
    const rawList = raw.matches ?? raw.Matches;
    const rawMatches = (Array.isArray(rawList) ? rawList : []) as Array<{
      vat?: unknown;
      score?: unknown;
      reason?: unknown;
    }>;

    return rawMatches.map((m) => {
      const score =
        typeof m.score === "string" && VALID_SCORES.has(m.score) ? m.score : "medium";
      const reason = typeof m.reason === "string" ? m.reason.trim().slice(0, 80) : "";
      return {
        vat: String(m.vat ?? ""),
        score: score as "high" | "medium" | "low",
        reason,
      };
    });
  } catch {
    return candidates.map((c) => ({
      vat: String(c.vat),
      score: "medium" as const,
      reason: "Match pending — retry shortly.",
    }));
  }
}
