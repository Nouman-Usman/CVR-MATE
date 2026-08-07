import { subjectKey } from "./keys";
import type { FollowUpCandidate, FollowUpItem, ResolvedCandidate } from "./types";

/**
 * Ranking for the follow-up queue. No DB, no clock, no randomness — every
 * function here is a pure function of its arguments, so the whole ordering is
 * unit-testable and two runs over the same rows always agree.
 */

const MAX_VALUE_BOOST = 15;
const MAX_CORROBORATION_BONUS = 10;
const CORROBORATION_PER_SIGNAL = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Money nudges priority, it does not decide it.
 *
 * Log-scaled on purpose: a 10M kr deal must outrank a 100k one, but linear
 * scaling would let one large deal bury a small deal whose quote expires
 * tomorrow. Log compresses the range so value acts as a tie-breaker between
 * comparable urgencies rather than a trump card. Capped at 15, roughly one
 * signal tier, so it can never promote a weak signal above a strong one.
 *
 * `amountOre` is INTEGER ØRE — the money unit across the whole CRM. Dividing by
 * 100 here is the only place the queue thinks in kroner, and it exists solely
 * because the log curve is calibrated to human-readable magnitudes.
 */
export function valueBoost(amountOre: number | null): number {
  if (amountOre == null || amountOre <= 0) return 0;
  const kroner = amountOre / 100;
  return Math.min(MAX_VALUE_BOOST, Math.log10(Math.max(1, kroner)) * 2.5);
}

/**
 * baseWeight (which signal) + urgency (how overdue) + value. Clamped 0..100.
 *
 * Rounded to an integer: the log curve produces values like 86.38560627359831,
 * and a score is a display value and a sort key, not a measurement. Extra
 * decimals only add ties that look meaningful and are not — the deterministic
 * tie-break in `rankQueue` handles the real ones.
 */
export function scoreCandidate(candidate: FollowUpCandidate, baseWeight: number): number {
  return Math.round(
    clamp(baseWeight + candidate.urgency + valueBoost(candidate.amountOre), 0, 100)
  );
}

/**
 * Deterministic ordering for candidates within one subject.
 *
 * Ties break on signalKey then entityId so the primary reason on a card does
 * not flip between reloads — the same discipline `lib/match-feed/rank.ts` uses.
 * A card whose headline changes at random reads as a bug even when the set of
 * reasons is identical.
 */
function byScoreDesc(a: ResolvedCandidate, b: ResolvedCandidate): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.signalKey !== b.signalKey) return a.signalKey < b.signalKey ? -1 : 1;
  return a.entityId < b.entityId ? -1 : a.entityId > b.entityId ? 1 : 0;
}

/**
 * Collapse candidates into one card per subject, ranked.
 *
 * One card per subject is what makes this a worklist rather than a notification
 * firehose: a rep works a deal, not a signal. A deal whose quote is unanswered
 * AND whose next step is overdue is one thing to do, not two.
 *
 * Corroboration adds a small bonus — a subject tripping several signals is
 * genuinely more neglected — but it is capped at +10 so three weak signals can
 * never outrank one urgent signal.
 */
export function rankQueue(candidates: ResolvedCandidate[]): FollowUpItem[] {
  const bySubject = new Map<string, ResolvedCandidate[]>();
  for (const candidate of candidates) {
    const key = subjectKey(candidate.subject);
    const bucket = bySubject.get(key);
    if (bucket) bucket.push(candidate);
    else bySubject.set(key, [candidate]);
  }

  const items: FollowUpItem[] = [];
  for (const bucket of bySubject.values()) {
    const sorted = [...bucket].sort(byScoreDesc);
    const [primary, ...others] = sorted;
    const bonus = Math.min(MAX_CORROBORATION_BONUS, CORROBORATION_PER_SIGNAL * others.length);
    items.push({
      subject: primary.subject,
      companyId: primary.companyId,
      score: clamp(primary.score + bonus, 0, 100),
      primary,
      others,
    });
  }

  return items.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.subject.id < b.subject.id ? -1 : a.subject.id > b.subject.id ? 1 : 0;
  });
}
