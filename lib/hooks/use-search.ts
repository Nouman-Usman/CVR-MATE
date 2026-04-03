"use client";

import { useQuery } from "@tanstack/react-query";

interface SearchResponse {
  results: Record<string, unknown>[];
  count: number;
  hasMore: boolean;
  error?: string;
}

export function useSearchCompanies(
  params: URLSearchParams | null,
  enabled: boolean
) {
  const paramString = params?.toString() ?? "";

  return useQuery<SearchResponse>({
    queryKey: ["search", paramString],
    queryFn: async () => {
      const res = await fetch(`/api/cvr/search?${paramString}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Search failed");
      }
      return res.json();
    },
    enabled: enabled && paramString.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}
