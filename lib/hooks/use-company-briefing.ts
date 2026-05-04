"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUpgradePrompt } from "./use-upgrade-prompt";

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
  const { triggerUpgrade } = useUpgradePrompt();

  return useMutation<BriefingResponse, Error & { upgrade?: boolean }, { vat: string; locale: string; companyData?: Record<string, unknown> }>({
    mutationFn: async ({ vat, locale, companyData }) => {
      const res = await fetch("/api/ai/company-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat, locale, companyData }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || "Failed to generate briefing") as Error & { upgrade?: boolean };
        if (data.upgrade) err.upgrade = true;
        throw err;
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["briefings", variables.vat] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (err) => {
      if (err.upgrade) triggerUpgrade("ai_usage");
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
