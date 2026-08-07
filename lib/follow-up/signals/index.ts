import "server-only";

import type { SignalKey } from "../keys";
import type { FollowUpCandidate, FollowUpSignal, SignalContext } from "../types";

import { contractRenewalSignal } from "./contract-renewal";
import { overdueNextStepSignal } from "./overdue-next-step";
import { quoteExpiredUnansweredSignal } from "./quote-expired-unanswered";
import { staleDealSignal } from "./stale-deal";
import { unansweredQuoteSignal } from "./unanswered-quote";

/**
 * The signal registry.
 *
 * Each signal is generic over its own row type, which means the concrete
 * signals cannot share a single `FollowUpSignal<T>` array — `evaluate` takes
 * `Row`, so the type is contravariant and `FollowUpSignal<Quote>` is not a
 * `FollowUpSignal<unknown>`. `toRunnable` closes over the row type at the call
 * site and hands back a uniform interface, which is the whole reason the
 * registry can stay a plain array.
 */
export interface RunnableSignal {
  readonly key: SignalKey;
  readonly baseWeight: number;
  run(ctx: SignalContext): Promise<FollowUpCandidate[]>;
}

export function toRunnable<Row>(signal: FollowUpSignal<Row>): RunnableSignal {
  return {
    key: signal.key,
    baseWeight: signal.baseWeight,
    async run(ctx: SignalContext) {
      const rows = await signal.select(ctx);
      const candidates: FollowUpCandidate[] = [];
      for (const row of rows) {
        const candidate = signal.evaluate(row, ctx);
        if (candidate) candidates.push(candidate);
      }
      return candidates;
    },
  };
}

/**
 * Registration order is not priority — `baseWeight` is. Listed loudest-first
 * only so the file reads in the order a rep would care.
 */
export const SIGNALS: readonly RunnableSignal[] = [
  toRunnable(overdueNextStepSignal),
  toRunnable(quoteExpiredUnansweredSignal),
  toRunnable(unansweredQuoteSignal),
  toRunnable(contractRenewalSignal),
  toRunnable(staleDealSignal),
];

export const BASE_WEIGHTS: Readonly<Record<SignalKey, number>> = Object.fromEntries(
  SIGNALS.map((signal) => [signal.key, signal.baseWeight])
) as Record<SignalKey, number>;
