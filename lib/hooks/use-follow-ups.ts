"use client";

import { useQuery } from "@tanstack/react-query";

import type { SignalKey, Subject } from "@/lib/follow-up/keys";

/**
 * The follow-up queue: what needs chasing today.
 *
 * `lib/follow-up/keys.ts` is deliberately free of `server-only` so the types
 * and the signal vocabulary can be shared with client components like this one;
 * everything that touches the database lives in `lib/follow-up/signals/*`.
 */

export interface FollowUpReason {
  key: string;
  params: Record<string, string | number>;
}

export type FollowUpAction =
  | { kind: "complete_todo"; todoId: string }
  | { kind: "open_quote"; quoteId: string }
  | { kind: "open_contract"; contractId: string }
  | { kind: "create_deal"; companyId: string };

export interface FollowUpSecondary {
  signalKey: SignalKey;
  reason: FollowUpReason;
  daysDelta: number;
  action: FollowUpAction | null;
}

export interface FollowUpEntry {
  subject: Subject;
  score: number;
  companyId: string;
  companyName: string | null;
  companyVat: string | null;
  dealTitle: string | null;
  dealAmount: number | null; // INTEGER ØRE — render with formatOre
  stageId: string | null;
  assignedUserId: string | null;
  signalKey: SignalKey;
  reason: FollowUpReason;
  daysDelta: number;
  action: FollowUpAction | null;
  others: FollowUpSecondary[];
}

export interface FollowUpsResponse {
  items: FollowUpEntry[];
  total: number;
  counts: Record<string, number>;
  generatedAt: string;
}

export function useFollowUps(options?: { scope?: "mine" | "org"; enabled?: boolean }) {
  const scope = options?.scope ?? "org";
  return useQuery<FollowUpsResponse>({
    queryKey: ["follow-ups", scope],
    queryFn: async () => {
      const res = await fetch(`/api/follow-ups?scope=${scope}`);
      if (!res.ok) throw new Error("Failed to load follow-ups");
      return res.json();
    },
    enabled: options?.enabled ?? true,
    // The queue is derived from live rows, so it goes stale as soon as anyone
    // moves a deal or logs a call. Short enough to feel current, long enough
    // that dragging cards around the board does not refetch on every drop.
    staleTime: 60_000,
  });
}

/**
 * Index the queue by deal id, for surfaces that are already showing deals.
 *
 * Company-subject cards are skipped: they exist precisely because there is no
 * deal, so they have nothing to attach to on a pipeline board.
 */
export function attentionByDeal(items: FollowUpEntry[] | undefined): Map<string, FollowUpEntry> {
  const map = new Map<string, FollowUpEntry>();
  for (const item of items ?? []) {
    if (item.subject.type === "deal") map.set(item.subject.id, item);
  }
  return map;
}

/** Score bands the board uses for its staleness dot. */
export function attentionTone(score: number): "red" | "amber" {
  return score >= 60 ? "red" : "amber";
}
