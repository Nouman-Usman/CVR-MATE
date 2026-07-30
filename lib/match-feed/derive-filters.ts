import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { matchProfile } from "@/db/schema";
import { generateAiJson } from "@/lib/ai";
import { formatBrandContext, type UserBrand } from "@/lib/get-user-brand";

/**
 * The TriggerFilter-shaped filter set `buildEsFilters` accepts. We keep
 * `min_employees` / `max_employees` even though `buildEsFilters` drops them
 * (they have no ES equivalent) because `rank.ts` may consult size preferences.
 * Carrying them here is harmless — they never reach Elasticsearch.
 */
export interface MatchFilters {
  branch_code?: string;
  industry_code?: string;
  city?: string;
  region?: string;
  company_type?: string;
  min_employees?: number;
  max_employees?: number;
  founded_after?: string; // ISO date; the recency lever
}

/**
 * The ONLY keys allowed to survive into `MatchFilters`. Anything else the LLM
 * (or a caller) hands us is dropped. Exported so the sanitizer's contract can
 * be unit-tested directly.
 */
export const VALID_FILTER_KEYS = [
  "branch_code",
  "industry_code",
  "city",
  "region",
  "company_type",
  "min_employees",
  "max_employees",
  "founded_after",
] as const;

const NUMERIC_KEYS = new Set<string>(["min_employees", "max_employees"]);

/**
 * Pure whitelist + coercion. Copies only `VALID_FILTER_KEYS` from `raw`,
 * coerces the numeric keys via `Number(...)` (dropping non-finite results),
 * trims strings, and drops empty / null / undefined values. No LLM, no DB.
 * This is the guarantee that only valid `buildEsFilters` keys are emitted.
 */
export function sanitizeMatchFilters(raw: Record<string, unknown>): MatchFilters {
  const out: MatchFilters = {};
  if (!raw || typeof raw !== "object") return out;

  const target = out as Record<string, unknown>;

  for (const key of VALID_FILTER_KEYS) {
    const value = raw[key];
    if (value === undefined || value === null) continue;

    if (NUMERIC_KEYS.has(key)) {
      // Reject empty strings before coercion (Number("") === 0).
      if (typeof value === "string" && value.trim() === "") continue;
      const n = Number(value);
      if (Number.isFinite(n)) target[key] = n;
      continue;
    }

    const str = (typeof value === "string" ? value : String(value)).trim();
    if (str === "") continue;
    target[key] = str;
  }

  return out;
}

/**
 * LLM step: translate the seller's brand / Knowledge Base into a minimal set of
 * company-registry filters describing their IDEAL CUSTOMERS, then sanitize.
 * Cold-start safe — returns `{}` when the brand is empty or the call fails.
 */
export async function deriveMatchFilters(params: {
  brand: UserBrand;
  locale?: string;
}): Promise<MatchFilters> {
  const { brand, locale } = params;

  const brandContext = formatBrandContext(brand);
  if (!brandContext) return {};

  const lang = locale === "da" ? "Danish" : "English";

  const systemPrompt =
    "You translate a Danish B2B seller's profile into company-registry search " +
    "filters that describe their IDEAL CUSTOMERS (not themselves).";

  const userPrompt = `${brandContext}

Using the seller profile above, produce Danish CVR company-registry filters that
describe the companies they should SELL TO (their ideal customers) — NOT their own
company. Use Danish CVR industry codes (branchekode / NACE) and Danish region names
(e.g. "hovedstaden", "midtjylland") where relevant. Keep it minimal: only include a
field when you are confident it narrows the registry toward good-fit customers.
Write any free-text values in ${lang}.

Respond with a JSON object of exactly this shape (omit fields you are unsure about):
{ "filters": { "industry_code"?: string, "city"?: string, "region"?: string, "company_type"?: string } }`;

  try {
    const raw = await generateAiJson<{ filters?: Record<string, unknown> }>({
      model: "claude-haiku-4-5-20251001",
      systemPrompt,
      userPrompt,
      maxTokens: 1024,
    });
    return sanitizeMatchFilters(raw?.filters ?? {});
  } catch {
    // Never block feed generation on a filter-derivation failure.
    return {};
  }
}

/**
 * Cache-aware wrapper. Returns cached filters when they exist and are at least
 * as fresh as the brand (`filtersComputedAt >= brand.updatedAt`); otherwise
 * re-derives and upserts the single `matchProfile` row for this user (via
 * Drizzle so `updatedAt`'s `$onUpdate` fires). Manual find-then-update/insert
 * upsert, mirroring `saveCompany`.
 */
export async function getMatchFilters(params: {
  userId: string;
  brand: UserBrand;
  locale?: string;
}): Promise<MatchFilters> {
  const { userId, brand, locale } = params;

  const existing = await db.query.matchProfile.findFirst({
    where: eq(matchProfile.userId, userId),
  });

  const brandUpdatedMs = brand.updatedAt ? new Date(brand.updatedAt).getTime() : 0;

  if (
    existing?.cachedFilters &&
    existing.filtersComputedAt &&
    new Date(existing.filtersComputedAt).getTime() >= brandUpdatedMs
  ) {
    return existing.cachedFilters as MatchFilters;
  }

  const filters = await deriveMatchFilters({ brand, locale });
  const now = new Date();

  if (existing) {
    await db
      .update(matchProfile)
      .set({ cachedFilters: filters, filtersComputedAt: now })
      .where(eq(matchProfile.id, existing.id));
  } else {
    await db.insert(matchProfile).values({
      userId,
      cachedFilters: filters,
      filtersComputedAt: now,
    });
  }

  return filters;
}
