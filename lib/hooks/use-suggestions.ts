"use client";

import { useQuery } from "@tanstack/react-query";
import type { CvrCompanyResult } from "@/lib/cvr-client";

interface SuggestResponse {
  results: CvrCompanyResult[];
}

export function useSuggestions(query: string) {
  return useQuery<SuggestResponse>({
    queryKey: ["suggestions", query],
    queryFn: async () => {
      const res = await fetch(
        `/api/cvr/suggest?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error("Suggestions failed");
      return res.json();
    },
    enabled: query.length >= 2,
    staleTime: 10 * 60_000,
  });
}
