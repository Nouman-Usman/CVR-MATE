"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface TriggerFilters {
  industry_code?: string;
  city?: string;
  region?: string;
  company_type?: string;
  min_employees?: number;
  max_employees?: number;
  founded_after?: string;
}

interface TriggerResult {
  id: string;
  matchCount: number;
  companies: { vat: number; name: string; city: string; industry: string; founded: string }[];
  createdAt: string;
}

export interface Trigger {
  id: string;
  name: string;
  filters: TriggerFilters;
  frequency: string;
  isActive: boolean;
  lastRunAt: string | null;
  notificationChannels: string[];
  createdAt: string;
  results?: TriggerResult[];
}

interface TriggersResponse {
  triggers: Trigger[];
}

export function useTriggers() {
  return useQuery<TriggersResponse>({
    queryKey: ["triggers"],
    queryFn: async () => {
      const res = await fetch("/api/triggers");
      if (!res.ok) throw new Error("Failed to fetch triggers");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useCreateTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      filters: TriggerFilters;
      frequency: string;
      notificationChannels: string[];
    }) => {
      const res = await fetch("/api/triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create trigger");
      return res.json();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["triggers"] }),
  });
}

export function useUpdateTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/triggers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update trigger");
      return res.json();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["triggers"] }),
  });
}

export function useDeleteTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/triggers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete trigger");
      return res.json();
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["triggers"] });
      const prev = qc.getQueryData<TriggersResponse>(["triggers"]);
      if (prev) {
        qc.setQueryData<TriggersResponse>(["triggers"], {
          triggers: prev.triggers.filter((t) => t.id !== id),
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["triggers"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["triggers"] }),
  });
}

export function useRunTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/triggers/${id}/run`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to run trigger");
      return res.json();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["triggers"] }),
  });
}
