"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, jsonRequest } from "@/lib/api/fetch-json";
import { qk, invalidate, crmInvalidations } from "@/lib/hooks/query-keys";
import type { QuoteLine } from "@/lib/hooks/use-quotes";

export interface OrderListItem {
  id: string;
  number: string;
  status: string;
  companyId: string;
  companyVat: string;
  companyName: string;
  currency: string;
  orderDate: string | null;
  expectedDelivery: string | null;
  total: number;
  createdAt: string;
}

export interface Order {
  id: string;
  number: string;
  status: string;
  companyId: string;
  quoteId: string | null;
  currency: string;
  orderDate: string | null;
  expectedDelivery: string | null;
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  total: number;
  notes: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

export function useOrders(status?: string) {
  // See the note on useQuotes: the page is capped, so `total` lets the UI
  // disclose truncation instead of hiding it.
  return useQuery<{ orders: OrderListItem[]; total: number }>({
    queryKey: [...qk.orders(), status ?? "all"],
    queryFn: () => fetchJson(`/api/orders${status ? `?status=${status}` : ""}`),
    staleTime: 30_000,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery<{ order: Order; lines: QuoteLine[]; company: { vat: string; name: string } | null }>({
    queryKey: qk.order(id ?? ""),
    enabled: !!id,
    queryFn: () => fetchJson(`/api/orders/${id}`),
    staleTime: 15_000,
  });
}

export function useUpdateOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { status?: string; expectedDelivery?: string; notes?: string }) =>
      fetchJson<{ order: Order }>(`/api/orders/${id}`, jsonRequest("PATCH", body)),
    onSettled: () => invalidate(qc, crmInvalidations.orderUpdated(id)),
  });
}
