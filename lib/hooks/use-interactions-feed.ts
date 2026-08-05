"use client";

import { useQuery } from "@tanstack/react-query";
import type { Interaction } from "@/lib/hooks/use-company-crm";

export interface FeedInteraction extends Interaction {
  companyVat: string;
  companyName: string;
}

/** Org-wide interactions feed (recent touchpoints across all companies). */
export function useInteractionsFeed() {
  return useQuery<{ interactions: FeedInteraction[] }>({
    queryKey: ["interactions-feed"],
    queryFn: async () => {
      const res = await fetch(`/api/interactions`);
      if (!res.ok) throw new Error("Failed to fetch interactions");
      return res.json();
    },
    staleTime: 30_000,
  });
}
