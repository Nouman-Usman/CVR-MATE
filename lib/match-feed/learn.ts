import { employeeBucket, type MatchPreferences } from "./rank";
import type { MatchCompanySnapshot } from "./generate";

const WEIGHT_CLAMP = 5; // preferences saturate at ±5 so a run of likes can't explode a weight

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Immutable preference update. On "accepted" bumps the company's industry code
 * and size bucket by +1; on "rejected" by -1; both clamped to [-WEIGHT_CLAMP, +WEIGHT_CLAMP].
 * Region is not learned here (snapshot has no region; only city). Returns a NEW
 * MatchPreferences object; never mutates the input. A null/empty snapshot is a no-op.
 */
export function applyDecision(
  preferences: MatchPreferences | null | undefined,
  snapshot: Partial<MatchCompanySnapshot> | null | undefined,
  decision: "accepted" | "rejected"
): MatchPreferences {
  // Deep-copy the learned maps so the caller's object is never mutated.
  const industry: Record<string, number> = { ...(preferences?.industry ?? {}) };
  const size: Record<string, number> = { ...(preferences?.size ?? {}) };

  const result: MatchPreferences = { industry, size };
  // Carry any existing region weights through untouched (region is not learned here).
  if (preferences?.region) {
    result.region = { ...preferences.region };
  }

  // Null/empty snapshot → no-op beyond the structural copy above.
  if (!snapshot) return result;

  const delta = decision === "accepted" ? 1 : -1;

  const code = snapshot.industryCode;
  if (typeof code === "string" && code.length > 0) {
    industry[code] = clamp((industry[code] ?? 0) + delta, -WEIGHT_CLAMP, WEIGHT_CLAMP);
  }

  const bucket = employeeBucket(snapshot.employees ?? "");
  if (bucket !== "unknown") {
    size[bucket] = clamp((size[bucket] ?? 0) + delta, -WEIGHT_CLAMP, WEIGHT_CLAMP);
  }

  return result;
}
