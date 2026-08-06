"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api/fetch-json";
import { qk } from "@/lib/hooks/query-keys";
import type { Interaction } from "@/lib/hooks/use-company-crm";

export interface FeedInteraction extends Interaction {
  companyVat: string;
  companyName: string;
}

/** Org-wide interactions feed (recent touchpoints across all companies). */
export function useInteractionsFeed() {
  return useQuery<{ interactions: FeedInteraction[] }>({
    queryKey: qk.interactionsFeed(),
    queryFn: () => fetchJson("/api/interactions"),
    staleTime: 30_000,
  });
}
