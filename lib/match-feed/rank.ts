import type { ParsedCompany } from "@/lib/cvr-api-elasticsearch";

/**
 * Learned per-user weights. `industry` is keyed by CVR industry code, `size` by
 * employee bucket, `region` by region name. Positive weights favour a candidate,
 * negative weights demote it. `region` is intentionally NOT used by the heuristic
 * here — candidates are already region-filtered upstream, so region preferences
 * only feed the LLM prompt (see `score.ts`).
 */
export interface MatchPreferences {
  industry?: Record<string, number>;
  size?: Record<string, number>;
  region?: Record<string, number>;
}

export interface RankedCandidate {
  company: ParsedCompany;
  heuristicScore: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Bucket a raw employee string (e.g. "5", "50-99", "–", "ANTAL_1") into a coarse
 * size band. Parses a leading integer if the string has one; anything else maps
 * to "unknown". Thresholds follow the EU SME convention.
 */
export function employeeBucket(
  employees: string
): "unknown" | "micro" | "small" | "medium" | "large" {
  const n = parseInt(employees ?? "", 10);
  if (!Number.isFinite(n)) return "unknown";
  if (n < 10) return "micro";
  if (n < 50) return "small";
  if (n < 250) return "medium";
  return "large";
}

/**
 * Deterministic heuristic ranker (given `now`). Prioritises newly-registered
 * companies, then applies learned industry / size weights:
 *
 *   heuristicScore = 3 * recency + industryWeight + 0.5 * sizeWeight
 *
 * Sorted by score DESC, stable (ties keep input order), sliced to `limit`.
 * No DB, no LLM — pure. If `opts.now` is omitted, `new Date()` is read here.
 */
export function rankCandidates(
  candidates: ParsedCompany[],
  preferences: MatchPreferences,
  opts?: { now?: Date; recencyWindowDays?: number; limit?: number }
): RankedCandidate[] {
  const now = opts?.now ?? new Date();
  const recencyWindowDays = opts?.recencyWindowDays ?? 90;
  const limit = opts?.limit ?? 15;

  const industryPrefs = preferences.industry ?? {};
  const sizePrefs = preferences.size ?? {};
  const nowMs = now.getTime();

  const scored = candidates.map((company, index) => {
    const foundedMs = Date.parse(company.founded);
    let recencyComponent = 0;
    if (Number.isFinite(foundedMs)) {
      const daysSinceFounded = (nowMs - foundedMs) / 86_400_000;
      recencyComponent = clamp(1 - daysSinceFounded / recencyWindowDays, 0, 1);
    }

    const industryWeight = industryPrefs[company.industryCode] ?? 0;
    const sizeWeight = sizePrefs[employeeBucket(company.employees)] ?? 0;

    const heuristicScore = 3 * recencyComponent + industryWeight + 0.5 * sizeWeight;
    return { company, heuristicScore, index };
  });

  scored.sort((a, b) => {
    if (b.heuristicScore !== a.heuristicScore) return b.heuristicScore - a.heuristicScore;
    return a.index - b.index; // stable: preserve input order on ties
  });

  return scored.slice(0, limit).map(({ company, heuristicScore }) => ({ company, heuristicScore }));
}
