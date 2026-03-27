"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface UsageQuota {
  used: number;
  limit: number; // -1 = unlimited
}

export interface SubscriptionData {
  plan: "free" | "go" | "flow";
  planName: string;
  price: number;
  currency: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  limits: {
    savedCompanies: number;
    triggers: number;
    aiFeatures: boolean;
    crm: boolean;
    exports: boolean;
    teamFeatures: boolean;
    prioritySupport: boolean;
    aiUsagesPerMonth: number;
    companySearchesPerMonth: number;
    exportsPerMonth: number;
  };
  usage: {
    aiUsages: UsageQuota;
    companySearches: UsageQuota;
    exports: UsageQuota;
  };
}

export function useSubscription() {
  return useQuery<SubscriptionData>({
    queryKey: ["subscription"],
    queryFn: async () => {
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

      // Already subscribed — redirect to billing portal to change plans
      if (res.status === 409) {
        const portalRes = await fetch("/api/stripe/portal", { method: "POST" });
        const portalData = await portalRes.json();
        if (portalRes.ok && portalData.url) {
          window.location.href = portalData.url;
          return portalData;
        }
        throw new Error(portalData.error || "Failed to open billing portal");
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

export function useChangePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (targetPlan: "free" | "go" | "flow") => {
      const res = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change plan");

      // If server says we need checkout (free → paid), initiate it
      if (data.action === "checkout" && data.priceId) {
        const checkoutRes = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priceId: data.priceId }),
        });
        const checkoutData = await checkoutRes.json();
        if (!checkoutRes.ok) throw new Error(checkoutData.error || "Failed to create checkout");
        if (checkoutData.url) window.location.href = checkoutData.url;
        return checkoutData;
      }

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
