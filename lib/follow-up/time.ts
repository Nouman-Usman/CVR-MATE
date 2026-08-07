/**
 * Pure date arithmetic for the follow-up queue.
 *
 * Every function takes the clock as an argument. Nothing here calls `Date.now()`
 * or `new Date()` with no argument — signals must be deterministic so their
 * `evaluate()` can be unit-tested across day boundaries with a frozen `now`,
 * and so the same input never produces two different queues.
 *
 * This also keeps the numbers off the render path. `lib/format.ts`'s `daysSince`
 * reads the clock and is currently called during render in the pipeline board,
 * which is an impure call under React Compiler rules; the queue sends
 * `daysDelta` precomputed instead.
 */

export const MS_PER_DAY = 86_400_000;

/**
 * Drizzle returns `date` columns as `YYYY-MM-DD` strings and `timestamp`
 * columns as `Date`. Both shapes reach `evaluate()`, so both are handled.
 */
export type DateOnly = string;

/** The UTC calendar date of an instant, as `YYYY-MM-DD`. */
export function toDateOnly(at: Date): DateOnly {
  return at.toISOString().slice(0, 10);
}

/**
 * Whole calendar days from `from` to `to`, both `YYYY-MM-DD`.
 *
 * Positive when `from` is earlier. Parsed field-by-field rather than through
 * `Date.parse` so a bare date is never nudged by the host timezone — the whole
 * point is that "expires today" means the same thing in Copenhagen and UTC.
 */
export function daysBetweenDates(from: DateOnly, to: DateOnly): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / MS_PER_DAY);
}

function utcMidnight(iso: DateOnly): number {
  return Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10))
  );
}

/**
 * Whole days elapsed since a timestamp, floored.
 *
 * Floored rather than rounded so "14 days stale" means at least 14 full days
 * have passed — a threshold the user can reason about without knowing the time
 * of day the deal moved.
 */
export function daysSinceInstant(from: Date, now: Date): number {
  return Math.floor((now.getTime() - from.getTime()) / MS_PER_DAY);
}

/** `now` shifted back by whole days. Used to build SQL cutoffs. */
export function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * MS_PER_DAY);
}
