"use client";

import { useQuery } from "@tanstack/react-query";

interface SearchResponse {
  results: Record<string, unknown>[];
  count: number;
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  error?: string;
}

export function useSearchCompanies(
  params: URLSearchParams | null,
  page: number,
  enabled: boolean
) {
  const paramString = params?.toString() ?? "";

  return useQuery<SearchResponse>({
    queryKey: ["search", paramString, page],
    queryFn: async () => {
      const p = new URLSearchParams(paramString);
      p.set("page", String(page));
      p.set("limit", "50");
      const res = await fetch(`/api/cvr/search?${p.toString()}`);
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
