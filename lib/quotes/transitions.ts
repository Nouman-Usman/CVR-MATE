/**
 * Quote status rules, as a pure decision function.
 *
 * These lived inline in `app/api/quotes/[id]/status/route.ts`, where they could
 * only be exercised by calling the route — which needs auth, a database and a
 * seeded org. Extracted so the matrix (including the illegal transitions and
 * the expiry boundary) is directly testable.
 *
 * This does NOT replace the conditional write in the route. The `from` status
 * is still enforced by `UPDATE … WHERE status = $from`, which is what makes
 * concurrent accept+reject safe; a check here would be a check-then-act race.
 * What this owns is the *rules*: which action leads where, what it stamps, and
 * whether the quote is still in date.
 */

export type QuoteAction = "accept" | "reject";

export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "converted";

export interface QuoteTransition {
  /** The only status this action may be applied to. */
  readonly from: QuoteStatus;
  readonly to: QuoteStatus;
  /** Column stamped with the transition time. */
  readonly stamp: "acceptedAt" | "rejectedAt";
  /** Shown when the conditional write matches no row. */
  readonly error: string;
}

/**
 * "send" is deliberately absent: sending must go through `/api/quotes/[id]/send`
 * so the snapshot is frozen and the public token minted in the same step. A
 * quote set to 'sent' here would have a customer link that 404s.
 */
export const QUOTE_TRANSITIONS: Record<QuoteAction, QuoteTransition> = {
  accept: {
    from: "sent",
    to: "accepted",
    stamp: "acceptedAt",
    error: "Only a sent quote can be accepted.",
  },
  reject: {
    from: "sent",
    to: "rejected",
    stamp: "rejectedAt",
    error: "Only a sent quote can be rejected.",
  },
};

export type TransitionDecision =
  | { ok: true; transition: QuoteTransition }
  | { ok: false; reason: "wrong-status" | "expired"; message: string };

/**
 * Decide whether `action` may be applied to a quote in `status`.
 *
 * `validUntil` and `today` are both `YYYY-MM-DD`. Lexicographic comparison is
 * correct for that format and avoids constructing a Date, which would drag the
 * server's timezone into a date-only decision.
 *
 * A quote is valid *through* its `validUntil` date, so expiry is `validUntil <
 * today`, not `<=`. Accepting on the final day is legal.
 */
export function evaluateQuoteTransition(
  action: QuoteAction,
  quote: { status: string; validUntil?: string | null },
  today: string
): TransitionDecision {
  const transition = QUOTE_TRANSITIONS[action];

  if (quote.status !== transition.from) {
    return { ok: false, reason: "wrong-status", message: transition.error };
  }

  // Only acceptance binds the seller to a price. A customer may still decline a
  // stale quote, and recording that is more useful than refusing it.
  if (action === "accept" && quote.validUntil && quote.validUntil < today) {
    return {
      ok: false,
      reason: "expired",
      message: `This quote expired on ${quote.validUntil}. Extend its validity or duplicate it.`,
    };
  }

  return { ok: true, transition };
}

/** `YYYY-MM-DD` for a given instant, in UTC — matches Postgres `current_date`. */
export function isoDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}
