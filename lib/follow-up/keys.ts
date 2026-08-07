/**
 * Follow-up vocabulary — deliberately CLIENT-SAFE.
 *
 * No `server-only` import here, and nothing in this file may reach for the DB.
 * The filter UI, the Zod schemas and the queue cards all need these keys, and
 * `lib/follow-up/signals/*` is server-only because it imports `@/db`. Same split
 * as `lib/activity/vocabulary.ts` vs `lib/activity/log.ts`.
 */

/**
 * Every signal the queue can raise, ordered by how loudly it shouts.
 *
 * Adding one costs: a file in `signals/`, an entry in `signals/index.ts`, a key
 * here, an i18n string pair, and a test. Deliberately NOT a DB enum or CHECK
 * constraint — a new signal must never require a migration.
 */
export const SIGNAL_KEYS = [
  "overdue_next_step",
  "quote_expired_unanswered",
  "unanswered_quote",
  "contract_renewal",
  "stale_deal",
] as const;

export type SignalKey = (typeof SIGNAL_KEYS)[number];

export function isSignalKey(value: string): value is SignalKey {
  return (SIGNAL_KEYS as readonly string[]).includes(value);
}

/**
 * What a queue card is about.
 *
 * It is NOT always a deal. `quote.dealId`, `contract.dealId` and
 * `interaction.dealId` are nullable and — verified against live data — null on
 * every existing row, because no form in the app sends them. `companyId` is
 * NOT NULL on all three, so it is the only reliable join.
 *
 * A card therefore resolves to the deal when one can be found, and falls back
 * to the company when it cannot. An unanswered quote to a company with no open
 * deal is the most important follow-up there is; dropping it would be wrong.
 */
export const SUBJECT_TYPES = ["deal", "company"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export interface Subject {
  type: SubjectType;
  id: string;
}

/** Stable string form, for Map keys and the `follow_up_state` unique index. */
export function subjectKey(subject: Subject): string {
  return `${subject.type}:${subject.id}`;
}

/** Wildcard used by `follow_up_state.entityId` for deal-level signals. */
export const ENTITY_WILDCARD = "*";
