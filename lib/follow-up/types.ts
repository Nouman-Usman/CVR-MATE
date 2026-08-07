import type { SignalKey, Subject } from "./keys";

/**
 * A reason is a key plus params — NEVER a rendered sentence.
 *
 * The same payload has to render Danish in the UI and (later) the recipient's
 * own language in the digest email. Formatting server-side would pick one and
 * be wrong for the other.
 */
export interface FollowUpReason {
  key: string;
  params: Record<string, string | number>;
}

/** What the card's primary button should do, when the signal implies one. */
export type FollowUpAction =
  | { kind: "complete_todo"; todoId: string }
  | { kind: "open_quote"; quoteId: string }
  | { kind: "open_contract"; contractId: string }
  | { kind: "create_deal"; companyId: string };

/**
 * What a signal produces for one row.
 *
 * Carries `companyId` + a possibly-null `dealId` rather than a resolved
 * `Subject`: resolving company → deal needs a query, and `evaluate()` must stay
 * pure. The collector batch-resolves subjects afterwards.
 */
export interface FollowUpCandidate {
  companyId: string;
  /** From the source row. Null on essentially every real row — see keys.ts. */
  dealId: string | null;
  signalKey: SignalKey;
  /**
   * The row the signal fired on — quote/contract/interaction id, or `'*'` when
   * the signal is about the deal itself. Part of the suppression key, so
   * dismissing one quote does not silence the next quote on the same deal.
   */
  entityId: string;
  reason: FollowUpReason;
  /** Signal-local escalation, 0..50. Added to the signal's baseWeight. */
  urgency: number;
  /** Whole days past due (positive) or until due (negative). Precomputed. */
  daysDelta: number;
  /**
   * Money at stake, INTEGER ØRE, from whichever row fired — quote total,
   * contract value, deal amount. Feeds a log-scaled boost in scoring. Null when
   * the signal has no natural amount.
   */
  amountOre: number | null;
  action?: FollowUpAction;
}

/** A candidate once the collector has decided which card it belongs to. */
export interface ResolvedCandidate extends FollowUpCandidate {
  subject: Subject;
  score: number;
}

/** One card. The unit a rep actually works. */
export interface FollowUpItem {
  subject: Subject;
  companyId: string;
  score: number;
  /** Highest-scoring candidate. Drives the headline reason and the CTA. */
  primary: ResolvedCandidate;
  /** Everything else on this subject, score-descending. Rendered as "+N more". */
  others: ResolvedCandidate[];
}

/**
 * Thresholds. Defaults live in the registry; an org may override any subset via
 * `follow_up_profile.config` (S4), which is why every field is required here
 * and the stored shape is a Partial.
 */
export interface FollowUpConfig {
  /** Days without a stage change before a deal is stale. */
  staleDays: number;
  /** Days without a stage change before it is worth mentioning. */
  staleWarnDays: number;
  /** Days after sending a quote with no response before chasing. */
  quoteSilentDays: number;
  /** Days before `validUntil` at which an unanswered quote escalates. */
  quoteExpiryWarnDays: number;
  /** How long an expired-unanswered quote keeps nagging before it goes quiet. */
  quoteExpiredLookbackDays: number;
  /** Extra days beyond the contract's own `renewalNoticeDays`. */
  renewalGraceDays: number;
  /** Minimum days between two notifications about the same item (S4). */
  notifyCooldownDays: number;
}

export const DEFAULT_FOLLOW_UP_CONFIG: FollowUpConfig = {
  staleDays: 14,
  staleWarnDays: 7,
  quoteSilentDays: 5,
  quoteExpiryWarnDays: 3,
  quoteExpiredLookbackDays: 30,
  renewalGraceDays: 0,
  notifyCooldownDays: 7,
};

/** Everything a signal needs. `now` is injected — never read the clock inside. */
export interface SignalContext {
  organizationId: string;
  now: Date;
  config: FollowUpConfig;
  /** Per-signal row cap, so one pathological org cannot stall the collector. */
  limit: number;
}

/**
 * A signal is a bounded query plus a pure predicate.
 *
 * Fully-pure would mean loading every deal and quote into memory to filter in
 * JS. Splitting it keeps the impure part to three lines of reviewable Drizzle
 * and leaves every threshold, escalation rule and reason key in `evaluate()`,
 * which is testable with no database at all.
 */
export interface FollowUpSignal<Row = unknown> {
  readonly key: SignalKey;
  /** Registry priority, 0..60. The floor of the final score. */
  readonly baseWeight: number;
  /** The only impure part. MUST filter by `ctx.organizationId` explicitly. */
  select(ctx: SignalContext): Promise<Row[]>;
  /** PURE. Row + clock in, candidate or null out. */
  evaluate(row: Row, ctx: SignalContext): FollowUpCandidate | null;
}
