"use client";

import { useMutation } from "@tanstack/react-query";

interface BriefingResponse {
  briefing: string;
  keyInsights: string[];
  suggestedApproach: string;
  error?: string;
}

export function useCompanyBriefing() {
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
  });
}
