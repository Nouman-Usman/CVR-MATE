"use client";

import { useMutation } from "@tanstack/react-query";

interface PrioritizedCompany {
  vat: string;
  name: string;
  score: "high" | "medium" | "low";
  reason: string;
}

interface Segment {
  name: string;
  vats: string[];
  insight: string;
}

interface NextAction {
  vat: string;
  name: string;
  action: string;
}

export interface PipelineResponse {
  prioritized: PrioritizedCompany[];
  segments: Segment[];
  nextActions: NextAction[];
  error?: string;
}

export function usePipelineAnalysis() {
  return useMutation<PipelineResponse, Error, { companyVats: string[]; locale: string }>({
    mutationFn: async ({ companyVats, locale }) => {
      const res = await fetch("/api/ai/analyze-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyVats, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze pipeline");
      return data;
    },
  });
}
