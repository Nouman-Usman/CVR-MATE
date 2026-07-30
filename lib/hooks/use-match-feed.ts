"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface MatchItem {
  id: string;
  cvr: string;
  companySnapshot: {
    name: string;
    city: string;
    industry: string;
    industryCode: string;
    founded: string;
    employees: string;
    form: string;
  } | null;
  rank: number;
  score: "high" | "medium" | "low";
  reason: string | null;
  feedDate: string;
  status: "pending";
}

interface MatchFeedResponse {
  entitled: boolean;
  matches: MatchItem[];
}

export interface UseMatchFeed {
  entitled: boolean;
  matches: MatchItem[];
  isLoading: boolean;
  isError: boolean;
  decide: (id: string, decision: "accepted" | "rejected") => void;
  isDeciding: boolean;
}

const MATCH_FEED_KEY = ["match-feed"] as const;

export function useMatchFeed(): UseMatchFeed {
  const queryClient = useQueryClient();

  const query = useQuery<MatchFeedResponse>({
    queryKey: MATCH_FEED_KEY,
    queryFn: async () => {
      const res = await fetch("/api/match-feed");
      if (!res.ok) throw new Error("Failed to load match feed");
      return res.json();
    },
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async ({
      id,
      decision,
    }: {
      id: string;
      decision: "accepted" | "rejected";
    }) => {
      const res = await fetch(`/api/match-feed/${id}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error("Failed to record decision");
      return res.json();
    },
    // Optimistic update — drop the decided card immediately so the deck advances.
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: MATCH_FEED_KEY });
      const prev = queryClient.getQueryData<MatchFeedResponse>(MATCH_FEED_KEY);
      if (prev) {
        queryClient.setQueryData<MatchFeedResponse>(MATCH_FEED_KEY, {
          ...prev,
          matches: prev.matches.filter((m) => m.id !== id),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(MATCH_FEED_KEY, context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: MATCH_FEED_KEY });
    },
  });

  const data = query.data;

  return {
    // Default to entitled while loading so the locked teaser never flashes.
    entitled: data?.entitled ?? true,
    matches: data?.matches ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    decide: (id, decision) => mutation.mutate({ id, decision }),
    isDeciding: mutation.isPending,
  };
}
