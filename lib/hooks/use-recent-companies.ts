"use client";

import { useQuery } from "@tanstack/react-query";
import type { CvrCompanyResult } from "@/lib/cvr-client";

interface RecentResponse {
  results: CvrCompanyResult[];
  count: number;
  from: string;
  error?: string;
}

export function useRecentCompanies(days = 7) {
  return useQuery<RecentResponse>({
    queryKey: ["recent-companies", days],
    queryFn: async () => {
      const res = await fetch(`/api/cvr/recent?days=${days}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch recent companies");
      }
      return res.json();
    },
    staleTime: 60 * 60_000, // 1 hour stale time on client
    gcTime: 24 * 60 * 60_000, // keep in GC for 24 hours
  });
}
