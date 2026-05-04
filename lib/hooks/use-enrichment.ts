"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUpgradePrompt } from "./use-upgrade-prompt";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CompanyEnrichment {
  id?: string;
  createdAt?: string;
  summary: string;
  leadScore: { grade: string; reason: string };
  financialHealth: { status: string; details: string };
  buyingSignals: string[];
  painPoints: string[];
  competitiveLandscape: string;
  riskFactors: string[];
  idealApproach: { channel: string; timing: string; angle: string };
  keyInsights: string[];
}

export interface PersonEnrichment {
  id?: string;
  createdAt?: string;
  summary: string;
  roleSignificance: string;
  networkInfluence: { score: string; details: string };
  careerTrajectory: { direction: string; details: string };
  engagementStrategy: { approach: string; topics: string[]; avoid: string };
  keyInsights: string[];
}

// ─── Saved enrichment query (Redis-first) ───────────────────────────────────

export function useSavedEnrichment<T>(type: "company" | "person", id: string | undefined) {
  return useQuery<{ enrichment: T | null }>({
    queryKey: ["enrichment", type, id],
    queryFn: async () => {
      const res = await fetch(`/api/ai/enrichment?type=${type}&id=${id}`);
      if (!res.ok) return { enrichment: null };
      return res.json();
    },
    enabled: !!id,
    staleTime: 5 * 60_000, // 5 minutes client-side
    retry: 2,
  });
}

// ─── Company enrichment mutation ────────────────────────────────────────────

export function useCompanyEnrichment() {
  const queryClient = useQueryClient();
  const { triggerUpgrade } = useUpgradePrompt();

  return useMutation<
    { enrichment: CompanyEnrichment },
    Error & { upgrade?: boolean },
    { vat: string; locale: string; companyData?: Record<string, unknown> }
  >({
    mutationFn: async ({ vat, locale, companyData }) => {
      const res = await fetch("/api/ai/enrich-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat, locale, companyData }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = new Error(data.error || "Failed to generate enrichment") as Error & { upgrade?: boolean };
        if (data.upgrade) err.upgrade = true;
        throw err;
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["enrichment", "company", variables.vat] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (err) => {
      if (err.upgrade) triggerUpgrade("enrichment");
    },
  });
}

// ─── Person enrichment mutation ─────────────────────────────────────────────

export function usePersonEnrichment() {
  const queryClient = useQueryClient();
  const { triggerUpgrade } = useUpgradePrompt();

  return useMutation<
    { enrichment: PersonEnrichment },
    Error & { upgrade?: boolean },
    {
      participantNumber: string;
      personName: string;
      locale: string;
      personData?: Record<string, unknown>;
      companies?: Record<string, unknown>[];
    }
  >({
    mutationFn: async (params) => {
      const res = await fetch("/api/ai/enrich-person", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = new Error(data.error || "Failed to generate enrichment") as Error & { upgrade?: boolean };
        if (data.upgrade) err.upgrade = true;
        throw err;
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["enrichment", "person", variables.participantNumber] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (err) => {
      if (err.upgrade) triggerUpgrade("enrichment");
    },
  });
}
