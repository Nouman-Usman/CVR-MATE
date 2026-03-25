"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface BriefingResponse {
  id?: string;
  briefing: string;
  keyInsights: string[];
  suggestedApproach: string;
  error?: string;
}

export interface SavedBriefing {
  id: string;
  companyVat: string;
  companyName: string;
  briefing: string;
  keyInsights: string[];
  suggestedApproach: string;
  createdAt: string;
}

export function useCompanyBriefing() {
  const queryClient = useQueryClient();

  return useMutation<BriefingResponse, Error, { vat: string; locale: string }>({
    mutationFn: async ({ vat, locale }) => {
      const res = await fetch("/api/ai/company-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate briefing");
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["briefings", variables.vat] });
    },
  });
}

export function useSavedBriefings(vat: string | undefined) {
  return useQuery<SavedBriefing[]>({
    queryKey: ["briefings", vat],
    queryFn: async () => {
      const res = await fetch(`/api/briefings?vat=${vat}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch briefings");
      }
      const data = await res.json();
      return data.briefings ?? [];
    },
    enabled: !!vat,
    staleTime: 0,
    retry: 2,
  });
}
