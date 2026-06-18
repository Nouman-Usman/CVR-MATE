"use client";

import { useQuery } from "@tanstack/react-query";

interface SearchResponse {
  results: Record<string, unknown>[];
  count: number;
  total: number;
  hasMore: boolean;
  truncated?: boolean;
  error?: string;
}

export function useSearchCompanies(
  params: URLSearchParams | null,
  enabled: boolean,
  page: number = 1,
  limit: number = 20
) {
  const paramString = params?.toString() ?? "";

  return useQuery<SearchResponse>({
    queryKey: ["search", paramString, page, limit],
    queryFn: async () => {
      const url = new URL(`/api/cvr/search`, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
      if (paramString) url.search = paramString;
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(limit));

      const res = await fetch(url.toString());
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = new Error(data.error || "Search failed") as Error & { upgrade?: boolean };
        if (data.upgrade || res.status === 403) err.upgrade = true;
        throw err;
      }
      return res.json();
    },
    enabled: enabled && paramString.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}
