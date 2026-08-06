"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, jsonRequest } from "@/lib/api/fetch-json";
import { qk, invalidate, crmInvalidations } from "@/lib/hooks/query-keys";

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
    queryKey: qk.companyActivity(vat),
    queryFn: () => fetchJson(`/api/companies/${vat}/activity`),
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
    queryKey: qk.companyNotes(vat),
    queryFn: () => fetchJson(`/api/companies/${vat}/notes`),
    staleTime: 60_000,
  });
}

export function useCreateNote(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      fetchJson<{ note: CompanyNote }>(
        `/api/companies/${vat}/notes`,
        jsonRequest("POST", { content })
      ),
    onSettled: () => invalidate(qc, [qk.companyNotes(vat), qk.companyActivity(vat)]),
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
    queryKey: qk.companyInteractions(vat),
    queryFn: () => fetchJson(`/api/companies/${vat}/interactions`),
    staleTime: 30_000,
  });
}

export function useCreateInteraction(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInteractionInput) =>
      fetchJson<{ interaction: Interaction }>(
        `/api/companies/${vat}/interactions`,
        jsonRequest("POST", body)
      ),
    onSettled: () => invalidate(qc, crmInvalidations.interactionChanged(vat)),
  });
}

export function useDeleteInteraction(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ message: string }>(`/api/interactions/${id}`, jsonRequest("DELETE")),
    onSettled: () => invalidate(qc, crmInvalidations.interactionChanged(vat)),
  });
}
