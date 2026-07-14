"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  isPrimary: boolean;
  lawfulBasis: string;
  source: string;
  consentAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContactsResponse {
  contacts: Contact[];
  total: number;
}

const key = (vat: string) => ["contacts", vat] as const;

export function useContacts(vat: string) {
  return useQuery<ContactsResponse>({
    queryKey: key(vat),
    queryFn: async () => {
      const res = await fetch(`/api/companies/${vat}/contacts`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useCreateContact(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/companies/${vat}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create contact");
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key(vat) });
      qc.invalidateQueries({ queryKey: ["company-activity", vat] });
    },
  });
}

export function useUpdateContact(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/companies/${vat}/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update contact");
      return data;
    },
    onMutate: async ({ id, ...body }) => {
      await qc.cancelQueries({ queryKey: key(vat) });
      const prev = qc.getQueryData<ContactsResponse>(key(vat));
      if (prev) {
        qc.setQueryData<ContactsResponse>(key(vat), {
          ...prev,
          contacts: prev.contacts.map((c) => (c.id === id ? { ...c, ...body } : c)),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key(vat), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key(vat) });
      qc.invalidateQueries({ queryKey: ["company-activity", vat] });
    },
  });
}

export function useDeleteContact(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/companies/${vat}/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete contact");
      return res.json();
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key(vat) });
      const prev = qc.getQueryData<ContactsResponse>(key(vat));
      if (prev) {
        qc.setQueryData<ContactsResponse>(key(vat), {
          total: Math.max(0, prev.total - 1),
          contacts: prev.contacts.filter((c) => c.id !== id),
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(key(vat), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key(vat) });
      qc.invalidateQueries({ queryKey: ["company-activity", vat] });
    },
  });
}
