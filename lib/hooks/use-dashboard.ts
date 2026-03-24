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
  });
}
