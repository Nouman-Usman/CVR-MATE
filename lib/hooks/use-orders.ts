"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  return useQuery<{ orders: OrderListItem[] }>({
    queryKey: ["orders", status ?? "all"],
    queryFn: async () => {
      const res = await fetch(`/api/orders${status ? `?status=${status}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery<{ order: Order; lines: QuoteLine[]; company: { vat: string; name: string } | null }>({
    queryKey: ["order", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) throw new Error("Failed to fetch order");
      return res.json();
    },
    staleTime: 15_000,
  });
}

export function useUpdateOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      status?: string;
      expectedDelivery?: string;
      notes?: string;
    }) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update order");
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
