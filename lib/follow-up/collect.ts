import "server-only";

import type { SignalKey } from "./keys";
import { rankQueue, scoreCandidate } from "./score";
import { BASE_WEIGHTS, SIGNALS } from "./signals";
import {
  companiesNeedingResolution,
  loadOpenDealsByCompany,
  resolveSubject,
} from "./subject";
import {
  DEFAULT_FOLLOW_UP_CONFIG,
  type FollowUpConfig,
  type FollowUpItem,
  type ResolvedCandidate,
  type SignalContext,
} from "./types";

/**
 * Builds the queue for one org, on demand.
 *
 * The queue is DERIVED, never materialised. Every signal is a bounded, indexed
 * predicate over rows the org already owns, so the result is a pure function of
 * (rows, now, config) and can be recomputed in milliseconds. Storing it would
 * buy three problems and no speed: rows that claim a deal is stale seconds
 * after a rep moved it, a second cron to retire conditions that went away, and
 * a permanent row for something that must be able to recur — a deal can go
 * stale, get worked, and go stale again.
 *
 * What genuinely cannot be recomputed — snooze, dismiss, drafts — is what gets
 * persisted, in S2 and S3.
 */

const DEFAULT_SIGNAL_LIMIT = 500;

export interface CollectParams {
  organizationId: string;
  /** Injected so the whole pipeline stays deterministic and testable. */
  now?: Date;
  config?: Partial<FollowUpConfig>;
  /** Per-signal row cap. One pathological org must not stall the collector. */
  limit?: number;
  /** Restrict to a subset of signals (the `?signal=` filter). */
  only?: SignalKey[];
}

export interface CollectResult {
  items: FollowUpItem[];
  counts: Record<string, number>;
  generatedAt: string;
}

export async function collectFollowUps(params: CollectParams): Promise<CollectResult> {
  const now = params.now ?? new Date();
  const ctx: SignalContext = {
    organizationId: params.organizationId,
    now,
    config: { ...DEFAULT_FOLLOW_UP_CONFIG, ...params.config },
    limit: params.limit ?? DEFAULT_SIGNAL_LIMIT,
  };

  const signals = params.only?.length
    ? SIGNALS.filter((signal) => params.only?.includes(signal.key))
    : SIGNALS;

  // Signals are independent, so they run concurrently. `allSettled` rather than
  // `all`: one broken signal must degrade the queue, not empty it.
  const settled = await Promise.allSettled(signals.map((signal) => signal.run(ctx)));
  const candidates = settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  // Resolve company → deal once for the whole batch (see subject.ts on why
  // almost every candidate needs this).
  const dealByCompany = await loadOpenDealsByCompany({
    organizationId: params.organizationId,
    companyIds: companiesNeedingResolution(candidates),
  });

  const resolved: ResolvedCandidate[] = candidates.map((candidate) => ({
    ...candidate,
    subject: resolveSubject(candidate, dealByCompany),
    score: scoreCandidate(candidate, BASE_WEIGHTS[candidate.signalKey] ?? 0),
  }));

  const counts: Record<string, number> = {};
  for (const candidate of resolved) {
    counts[candidate.signalKey] = (counts[candidate.signalKey] ?? 0) + 1;
  }

  return {
    items: rankQueue(resolved),
    counts,
    generatedAt: now.toISOString(),
  };
}
