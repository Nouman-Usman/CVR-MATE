import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { matchFeedItem, savedCompany, matchProfile } from "@/db/schema";
import { getUserBrand } from "@/lib/get-user-brand";
import { buildEsFilters } from "@/lib/triggers/build-es-filters";
import { searchCompaniesElasticsearch, type ParsedCompany } from "@/lib/cvr-api-elasticsearch";
import { getMatchFilters } from "./derive-filters";
import { rankCandidates, type MatchPreferences } from "./rank";
import { scoreMatches } from "./score";

/** Denormalized display snapshot persisted on each feed row. */
export interface MatchCompanySnapshot {
  name: string;
  city: string;
  industry: string;
  industryCode: string;
  founded: string;
  employees: string;
  form: string;
}

export interface GeneratedMatch {
  cvr: string;
  companySnapshot: MatchCompanySnapshot;
  rank: number;
  score: "high" | "medium" | "low";
  reason: string;
}

export interface GenerateResult {
  matches: GeneratedMatch[];
  steps: {
    hasBrand: boolean;
    retrieved: number;
    afterExclusion: number;
    preRanked: number;
    scored: number;
    llmCalls: number;
  };
}

const ES_PAGE_SIZE = 100;
const MAX_PAGES = 2; // cap retrieval at ≤200 candidates
const INSERT_BATCH_SIZE = 100;

const SCORE_RANK: Record<"high" | "medium" | "low", number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** "YYYY-MM-DD" for the given instant, in UTC. */
export function toFeedDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Retrieve-then-rank match funnel for one user. Pulls recent Danish companies
 * matching the user's derived filters, excludes anything already seen or saved,
 * heuristically pre-ranks, LLM-scores the survivors in one batched call, and
 * returns up to `feedLimit` ranked matches. Does NOT persist — see
 * `persistMatchFeed`.
 */
export async function generateMatchFeed(params: {
  userId: string;
  organizationId: string | null;
  locale?: string;
  now?: Date;
  recentDays?: number; // default 30 — life_start window
  candidateLimit?: number; // default 15 — pre-rank cutoff
  feedLimit?: number; // default 10 — final feed size
}): Promise<GenerateResult> {
  const {
    userId,
    locale = "en",
    now = new Date(),
    recentDays = 30,
    candidateLimit = 15,
    feedLimit = 10,
  } = params;

  // 1. Brand / cold-start guard — no Knowledge Base, no matches.
  const brand = await getUserBrand(userId);
  if (!brand) {
    return {
      matches: [],
      steps: {
        hasBrand: false,
        retrieved: 0,
        afterExclusion: 0,
        preRanked: 0,
        scored: 0,
        llmCalls: 0,
      },
    };
  }

  // 2. Filters (cache-aware) + recency lever. Clone before mutating so we never
  //    write back into a cached/returned object.
  const filters = { ...(await getMatchFilters({ userId, brand, locale })) };
  filters.founded_after = toFeedDate(new Date(now.getTime() - recentDays * 86_400_000));

  // 3. Translate to Elasticsearch filter keys.
  const esFilters = buildEsFilters(filters as Record<string, unknown>);

  // 4. Retrieve (≤2 pages), drop dissolved, dedupe by VAT.
  const collected: ParsedCompany[] = [];
  const collectedVats = new Set<string>();
  for (let p = 1; p <= MAX_PAGES; p++) {
    const result = await searchCompaniesElasticsearch(esFilters, p, ES_PAGE_SIZE);
    for (const c of result.companies) {
      if (c.isDissolved) continue;
      const vat = String(c.vat);
      if (collectedVats.has(vat)) continue;
      collectedVats.add(vat);
      collected.push(c);
    }
    if (!result.hasMore) break;
  }
  const retrieved = collected.length;

  // 5. Exclude anything the user has already been shown or has saved.
  const seen = await db
    .select({ cvr: matchFeedItem.cvr })
    .from(matchFeedItem)
    .where(eq(matchFeedItem.userId, userId));
  const saved = await db
    .select({ cvr: savedCompany.cvr })
    .from(savedCompany)
    .where(eq(savedCompany.userId, userId));
  const excluded = new Set([...seen, ...saved].map((r) => String(r.cvr)));
  const remaining = collected.filter((c) => !excluded.has(String(c.vat)));
  const afterExclusion = remaining.length;

  // 6. Learned preferences.
  const profile = await db.query.matchProfile.findFirst({
    where: eq(matchProfile.userId, userId),
  });
  const preferences = (profile?.preferences ?? {}) as MatchPreferences;

  // 7. Heuristic pre-rank.
  const ranked = rankCandidates(remaining, preferences, { now, limit: candidateLimit });
  const preRanked = ranked.length;

  // 8. Cost guard — nothing survived, skip the LLM entirely.
  if (ranked.length === 0) {
    return {
      matches: [],
      steps: {
        hasBrand: true,
        retrieved,
        afterExclusion,
        preRanked,
        scored: 0,
        llmCalls: 0,
      },
    };
  }

  // 9. LLM scoring — one batched call.
  const scores = await scoreMatches({
    candidates: ranked.map((r) => r.company),
    brand,
    preferences,
    locale,
  });
  const llmCalls = 1;

  // 10. Merge scores back, sort by score-tier then heuristic, cut to feedLimit.
  const scoreByVat = new Map(scores.map((s) => [String(s.vat), s]));

  const merged = ranked.map((r) => {
    const s = scoreByVat.get(String(r.company.vat));
    return {
      candidate: r,
      score: s?.score ?? "medium",
      reason: s?.reason ?? "",
    };
  });

  merged.sort((a, b) => {
    const tier = SCORE_RANK[b.score] - SCORE_RANK[a.score];
    if (tier !== 0) return tier;
    return b.candidate.heuristicScore - a.candidate.heuristicScore;
  });

  const matches: GeneratedMatch[] = merged.slice(0, feedLimit).map((m, i) => {
    const c = m.candidate.company;
    return {
      cvr: String(c.vat),
      companySnapshot: {
        name: c.name,
        city: c.city,
        industry: c.industry,
        industryCode: c.industryCode,
        founded: c.founded,
        employees: c.employees,
        form: c.form,
      },
      rank: i + 1,
      score: m.score,
      reason: m.reason,
    };
  });

  return {
    matches,
    steps: {
      hasBrand: true,
      retrieved,
      afterExclusion,
      preRanked,
      scored: scores.length,
      llmCalls,
    },
  };
}

/**
 * Chunked, conflict-safe insert of generated matches. The UNIQUE(userId, cvr)
 * index means a conflict = the user has already seen that company, so
 * `onConflictDoNothing` silently skips it. Returns the number of rows actually
 * inserted.
 */
export async function persistMatchFeed(params: {
  userId: string;
  organizationId: string | null;
  matches: GeneratedMatch[];
  feedDate: string;
}): Promise<number> {
  const { userId, organizationId, matches, feedDate } = params;
  if (matches.length === 0) return 0;

  const rows = matches.map((m) => ({
    userId,
    organizationId,
    cvr: m.cvr,
    companySnapshot: m.companySnapshot,
    feedDate,
    rank: m.rank,
    score: m.score,
    reason: m.reason,
    status: "pending",
  }));

  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const result = await db
      .insert(matchFeedItem)
      .values(batch)
      .onConflictDoNothing()
      .returning();
    inserted += result.length;
  }

  return inserted;
}
