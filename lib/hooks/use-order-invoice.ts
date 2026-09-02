"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface OrderInvoiceMirror {
  id: string;
  provider: string;
  externalId: string;
  invoiceNumber: string | null;
  status: "draft" | "booked" | "sent" | "paid" | "overdue" | "credited" | "cancelled";
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  total: number;
  vatTotal: number;
  totalsMismatch: boolean;
  pdfUrl: string | null;
  lastSyncedAt: string | null;
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

/** The mirrored invoice for an order, or null if it has not been invoiced. */
export function useOrderInvoice(orderId: string) {
  return useQuery({
    queryKey: ["order-invoice", orderId],
    queryFn: async () =>
      json<{ invoice: OrderInvoiceMirror | null }>(
        await fetch(`/api/orders/${orderId}/invoice`, { credentials: "include" })
      ),
    enabled: Boolean(orderId),
  });
}

/**
 * Hand the order to the bookkeeping system.
 *
 * Creates a draft only — the response's `nextStep` says so, and the UI repeats
 * it, because "invoiced" would overstate what happened.
 */
export function useCreateDraftInvoice(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      json<{
        invoiceId: string;
        externalId: string;
        status: string;
        totalsMismatch: boolean;
        mismatchReason: string | null;
        nextStep: string;
      }>(
        await fetch(`/api/orders/${orderId}/invoice`, {
          method: "POST",
          credentials: "include",
        })
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-invoice", orderId] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });
}

/** Ask the provider for its current answer. The only write a user can trigger. */
export function useSyncInvoices(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      json<{ checked: number; updated: number; failed: number }>(
        await fetch(`/api/orders/${orderId}/invoice`, {
          method: "PATCH",
          credentials: "include",
        })
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order-invoice", orderId] }),
  });
}
