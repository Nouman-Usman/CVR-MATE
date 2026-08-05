"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Activity feed ────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  actor: { id: string; name: string | null; image: string | null } | null;
  createdAt: string;
}

export function useCompanyActivity(vat: string) {
  return useQuery<{ activity: ActivityItem[] }>({
    queryKey: ["company-activity", vat],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${vat}/activity`);
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    staleTime: 30_000,
  });
}

// ─── Notes ─────────────────────────────────────────────────────────────────

export interface CompanyNote {
  id: string;
  companyId: string;
  content: string;
  author: { id: string; name: string | null; image: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export function useCompanyNotes(vat: string) {
  return useQuery<{ notes: CompanyNote[]; total: number }>({
    queryKey: ["company-notes", vat],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${vat}/notes`);
      if (!res.ok) throw new Error("Failed to fetch notes");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useCreateNote(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/companies/${vat}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add note");
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["company-notes", vat] });
      qc.invalidateQueries({ queryKey: ["company-activity", vat] });
    },
  });
}

// ─── Interactions (typed touchpoints + follow-ups) ──────────────────────────

export interface Interaction {
  id: string;
  companyId: string;
  contactId: string | null;
  dealId: string | null;
  type: string;
  direction: string;
  occurredAt: string;
  subject: string | null;
  body: string | null;
  topics: string[];
  nextStep: string | null;
  nextStepAt: string | null;
  source: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInteractionInput {
  type: "meeting" | "visit" | "call" | "email" | "note";
  direction?: "inbound" | "outbound" | "internal";
  occurredAt?: string;
  subject?: string;
  body?: string;
  topics?: string[];
  nextStep?: string;
  nextStepAt?: string;
  contactId?: string;
  dealId?: string;
}

export function useCompanyInteractions(vat: string) {
  return useQuery<{ interactions: Interaction[]; total: number }>({
    queryKey: ["company-interactions", vat],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${vat}/interactions`);
      if (!res.ok) throw new Error("Failed to fetch interactions");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useCreateInteraction(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateInteractionInput) => {
      const res = await fetch(`/api/companies/${vat}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to log interaction");
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["company-interactions", vat] });
      qc.invalidateQueries({ queryKey: ["company-activity", vat] });
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}

export function useDeleteInteraction(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/interactions/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete interaction");
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["company-interactions", vat] });
      qc.invalidateQueries({ queryKey: ["company-activity", vat] });
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}
