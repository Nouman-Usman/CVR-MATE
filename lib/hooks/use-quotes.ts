"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, jsonRequest } from "@/lib/api/fetch-json";
import { qk, invalidate, crmInvalidations } from "@/lib/hooks/query-keys";

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
  /** Frozen document as sent; null until the quote is sent. */
  snapshot: unknown;
  /** Capability token for the public customer page; null until sent. */
  publicToken: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
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
  // `total` is the org's full count for the current filter; the page is capped,
  // so the UI must say so rather than presenting a truncated list as complete.
  return useQuery<{ quotes: QuoteListItem[]; total: number }>({
    queryKey: [...qk.quotes(), status ?? "all"],
    queryFn: () => fetchJson(`/api/quotes${status ? `?status=${status}` : ""}`),
    staleTime: 30_000,
  });
}

export function useQuote(id: string | undefined) {
  return useQuery<{ quote: Quote; lines: QuoteLine[]; company: { vat: string; name: string } | null }>({
    queryKey: qk.quote(id ?? ""),
    enabled: !!id,
    queryFn: () => fetchJson(`/api/quotes/${id}`),
    staleTime: 15_000,
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateQuoteInput) =>
      fetchJson<{ quote: Quote; companyVat?: string }>("/api/quotes", jsonRequest("POST", body)),
    onSettled: (data) => invalidate(qc, crmInvalidations.quoteCreated(data?.companyVat)),
  });
}

export function useUpdateQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CreateQuoteInput>) =>
      fetchJson<{ quote: Quote; companyVat?: string }>(
        `/api/quotes/${id}`,
        jsonRequest("PATCH", body)
      ),
    onSettled: (data) => invalidate(qc, crmInvalidations.quoteUpdated(id, data?.companyVat)),
  });
}

export function useQuoteStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: "send" | "accept" | "reject") =>
      fetchJson<{ quote: Quote; dealId: string | null; companyVat?: string }>(
        `/api/quotes/${id}/status`,
        jsonRequest("POST", { action })
      ),
    // Accepting rolls the quote total into deal.amount server-side, so the board
    // and deal drawer are stale until crmInvalidations refreshes them.
    onSettled: (data) =>
      invalidate(qc, crmInvalidations.quoteStatusChanged(id, data?.companyVat, data?.dealId)),
  });
}

export function useConvertQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ order: { id: string; number: string }; companyVat?: string }>(
        `/api/quotes/${id}/convert`,
        jsonRequest("POST")
      ),
    onSettled: (data) => invalidate(qc, crmInvalidations.quoteConverted(id, data?.companyVat)),
  });
}

export interface SendQuoteResult {
  quote: Quote;
  quoteUrl: string;
  /** False when the document was sent but delivery failed — surface it. */
  emailed: boolean;
  emailError: string | null;
  companyVat?: string;
}

export function useSendQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { to: string; message?: string }) =>
      fetchJson<SendQuoteResult>(`/api/quotes/${id}/send`, jsonRequest("POST", body)),
    onSettled: (data) => invalidate(qc, crmInvalidations.quoteUpdated(id, data?.companyVat)),
  });
}

export function useDuplicateQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ quote: Quote; companyVat?: string }>(
        `/api/quotes/${id}/duplicate`,
        jsonRequest("POST")
      ),
    onSettled: (data) => invalidate(qc, crmInvalidations.quoteCreated(data?.companyVat)),
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ message: string; companyVat?: string }>(
        `/api/quotes/${id}`,
        jsonRequest("DELETE")
      ),
    onSettled: (data) => invalidate(qc, crmInvalidations.quoteCreated(data?.companyVat)),
  });
}
