"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface QuoteListItem {
  id: string;
  number: string;
  status: string;
  companyId: string;
  companyVat: string;
  companyName: string;
  currency: string;
  issueDate: string | null;
  validUntil: string | null;
  total: number; // øre
  createdAt: string;
}

export interface QuoteLine {
  id: string;
  productId: string | null;
  description: string;
  quantity: string;
  unitPrice: number;
  discountPct: string;
  vatRate: string;
  lineSubtotal: number;
  lineDiscount: number;
  lineVat: number;
  lineTotal: number;
  sortOrder: number;
}

export interface Quote {
  id: string;
  number: string;
  status: string;
  companyId: string;
  dealId: string | null;
  currency: string;
  issueDate: string | null;
  validUntil: string | null;
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  total: number;
  terms: string | null;
  notes: string | null;
  convertedOrderId: string | null;
  createdAt: string;
}

export interface QuoteLineInput {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number; // øre
  discountPct?: number;
  vatRate?: number;
}

export interface CreateQuoteInput {
  cvr?: string;
  companyId?: string;
  dealId?: string;
  issueDate?: string;
  validUntil?: string;
  terms?: string;
  notes?: string;
  lines: QuoteLineInput[];
}

export function useQuotes(status?: string) {
  return useQuery<{ quotes: QuoteListItem[] }>({
    queryKey: ["quotes", status ?? "all"],
    queryFn: async () => {
      const res = await fetch(`/api/quotes${status ? `?status=${status}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useQuote(id: string | undefined) {
  return useQuery<{ quote: Quote; lines: QuoteLine[]; company: { vat: string; name: string } | null }>({
    queryKey: ["quote", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/quotes/${id}`);
      if (!res.ok) throw new Error("Failed to fetch quote");
      return res.json();
    },
    staleTime: 15_000,
  });
}

function invalidateQuotes(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["quotes"] });
  qc.invalidateQueries({ queryKey: ["orders"] });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateQuoteInput) => {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create quote");
      return data as { quote: Quote };
    },
    onSettled: () => invalidateQuotes(qc),
  });
}

export function useUpdateQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<CreateQuoteInput>) => {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update quote");
      return data as { quote: Quote };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["quote", id] });
      invalidateQuotes(qc);
    },
  });
}

export function useQuoteStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (action: "send" | "accept" | "reject") => {
      const res = await fetch(`/api/quotes/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["quote", id] });
      invalidateQuotes(qc);
    },
  });
}

export function useConvertQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/quotes/${id}/convert`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to convert quote");
      return data as { order: { id: string; number: string } };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["quote", id] });
      invalidateQuotes(qc);
    },
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete quote");
      return data;
    },
    onSettled: () => invalidateQuotes(qc),
  });
}
