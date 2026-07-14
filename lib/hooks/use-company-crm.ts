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
