"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlanId } from "@/lib/stripe/plans";

export interface UsageQuota {
  used: number;
  limit: number; // -1 = unlimited
}

export interface SubscriptionData {
  plan: PlanId;
  planName: string;
  price: number;
  annualPrice: number;
  currency: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  limits: {
    savedCompanies: number;
    triggers: number;
    followedPeople: number;
    tasks: number;
    crmConnections: number;
    companySearchesPerMonth: number;
    aiUsagesPerMonth: number;
    enrichmentsPerMonth: number;
    emailDraftsPerMonth: number;
    linkedinDraftsPerMonth: number;
    phoneDraftsPerMonth: number;
    exportsPerMonth: number;
    aiTaskSuggestPerMonth: number;
    bulkPushPerMonth: number;
    teamFeatures: boolean;
    brandPersonalization: boolean;
    calendarExport: boolean;
    contextMenus: boolean;
    prioritySupport: boolean;
  };
  usage: Record<string, UsageQuota>;
}

export function useSubscription() {
  return useQuery<SubscriptionData>({
    queryKey: ["subscription"],
    queryFn: async () => {
      // Force-sync from Stripe first, then fetch
      await fetch("/api/stripe/subscription", { method: "POST" }).catch(() => {});
      const res = await fetch("/api/stripe/subscription");
      if (!res.ok) throw new Error("Failed to fetch subscription");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: async (priceId: string) => {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();

      if (res.status === 409) {
        throw new Error(data.error || "Cancel your current plan first to switch.");
      }

      if (!res.ok) throw new Error(data.error || "Failed to create checkout");
      if (data.url) window.location.href = data.url;
      return data;
    },
  });
}

export function useCustomerPortal() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open billing portal");
      if (data.url) window.location.href = data.url;
      return data;
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stripe/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel subscription");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}

export function useResumeSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stripe/resume", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resume subscription");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}

export function useExportCheck() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/exports/check", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export not allowed");
      return data as { allowed: boolean; used: number; limit: number };
    },
  });
}
