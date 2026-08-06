"use client";

import { useQuery } from "@tanstack/react-query";

interface DashboardCompany {
  name: string;
  industry: string;
  employees: string;
  score: string;
  date: string;
  vat: number;
  triggerName: string;
}

export interface DashboardData {
  stats: {
    savedCompanies: number;
    savedSearches: number;
    activeTriggers: number;
    activeTasks: number;
  };
  weeklyActivity: number[];
  recentCompanies: DashboardCompany[];
  /**
   * Org-scoped deal aggregate. The API has returned this for some time but the
   * type omitted it, so every consumer was typed as if it did not exist and the
   * data was fetched and discarded on every dashboard load.
   */
  pipeline?: {
    byStatus: { status: string; total: number; count: number }[];
    openValue: number;
    openCount: number;
  };
  /**
   * Org-scoped CRM metrics, keyed by metric id (see lib/dashboard/metrics.ts).
   * Absent when the user has no active organisation, which is how the picker
   * knows to mark those metrics unavailable rather than showing them as zero.
   */
  crm?: Record<string, number>;
}

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: (count, error) => {
      // Don't retry auth errors
      if (error?.message?.includes("401")) return false;
      return count < 2;
    },
  });
}
