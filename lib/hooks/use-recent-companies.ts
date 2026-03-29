"use client";

import { useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CvrCompanyResult } from "@/lib/cvr-client";

interface RecentResponse {
  results: CvrCompanyResult[];
  count: number;
  from: string;
  error?: string;
}

export function useRecentCompanies(days = 7) {
  const queryClient = useQueryClient();
  const forceRef = useRef(false);

  const query = useQuery<RecentResponse>({
    queryKey: ["recent-companies", days],
    queryFn: async () => {
      const params = new URLSearchParams({ days: String(days) });
      if (forceRef.current) {
        params.set("force", "1");
        forceRef.current = false;
      }
      const res = await fetch(`/api/cvr/recent?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch recent companies");
      }
      return res.json();
    },
    staleTime: 60 * 60_000, // 1 hour stale time on client
    gcTime: 24 * 60 * 60_000, // keep in GC for 24 hours
  });

  const forceRefresh = useCallback(() => {
    forceRef.current = true;
    queryClient.invalidateQueries({ queryKey: ["recent-companies", days] });
  }, [queryClient, days]);

  return { ...query, forceRefresh };
}
