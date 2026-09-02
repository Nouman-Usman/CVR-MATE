"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { SettingsChoice } from "@/lib/accounting/types";

export interface AccountingConnectionView {
  id: string;
  provider: string;
  agreementName: string | null;
  connectedAt: string;
  lastSyncedAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  settings: Record<string, unknown>;
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

const KEY = ["accounting-connection"];

/** The org's bookkeeping connection. Never includes the credential. */
export function useAccountingConnection() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () =>
      json<{ connection: AccountingConnectionView | null }>(
        await fetch("/api/accounting/connection", { credentials: "include" })
      ),
    // A 403 here means no org or no Enterprise plan; the section hides itself
    // rather than retrying into a rate limit.
    retry: false,
  });
}

/**
 * Connect an agreement.
 *
 * Settings are deliberately not sent: the server reads them from the agreement
 * and returns what it picked, so nobody has to look up internal e-conomic
 * numbers by hand.
 */
export function useConnectAccounting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { provider: string; accessToken: string }) =>
      json<{
        connection: AccountingConnectionView;
        choices: SettingsChoice[];
        needsReview: boolean;
      }>(
        await fetch("/api/accounting/connection", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Re-read the agreement's defaults, to review or correct a guess. */
export function useRediscoverSettings(provider: string) {
  return useMutation({
    mutationFn: async () =>
      json<{ choices: SettingsChoice[]; needsReview: boolean }>(
        await fetch(`/api/accounting/connection?provider=${provider}&rediscover=1`, {
          method: "PATCH",
          credentials: "include",
        })
      ),
  });
}

/** Correct the stored configuration — a wrong VAT zone invoices at the wrong rate. */
export function useUpdateAccountingSettings(provider: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Record<string, unknown>) =>
      json<{ settings: Record<string, unknown> }>(
        await fetch(`/api/accounting/connection?provider=${provider}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings }),
        })
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDisconnectAccounting(provider: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      json<{ ok: boolean }>(
        await fetch(`/api/accounting/connection?provider=${provider}`, {
          method: "DELETE",
          credentials: "include",
        })
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
