"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface CrmConnectionInfo {
  id: string;
  provider: string;
  isActive: boolean;
  connectedAt: string;
  lastRefreshedAt: string | null;
  scopes: string | null;
}

interface SyncStatus {
  provider: string;
  connectionId: string;
  synced: boolean;
  syncStatus: string | null;
  lastSyncedAt: string | null;
  crmEntityId: string | null;
  syncError: string | null;
}

interface SyncResult {
  success: boolean;
  crmEntityId: string;
  action: string;
  provider: string;
}

interface BulkSyncResult {
  results: { companyId: string; status: "success" | "error"; error?: string }[];
  summary: { total: number; success: number; failed: number };
}

interface SyncLogEntry {
  id: string;
  action: string;
  localEntityType: string | null;
  localEntityId: string | null;
  crmEntityId: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  connection: { provider: string };
}

export function useIntegrations() {
  return useQuery<{ connections: CrmConnectionInfo[] }>({
    queryKey: ["integrations"],
    queryFn: async () => {
      const res = await fetch("/api/integrations");
      if (!res.ok) throw new Error("Failed to fetch integrations");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useActiveConnections() {
  const { data } = useIntegrations();
  return (data?.connections ?? []).filter((c) => c.isActive);
}

export function useCrmDisconnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (provider: string) => {
      const res = await fetch(`/api/integrations/${provider}/disconnect`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });
}

export function usePushToCrm() {
  const queryClient = useQueryClient();

  return useMutation<SyncResult, Error, { connectionId: string; companyId: string }>({
    mutationFn: async ({ connectionId, companyId }) => {
      const res = await fetch("/api/integrations/sync/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, companyId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Sync failed");
      }
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["sync-history"] });
    },
  });
}

export function useBulkPushToCrm() {
  const queryClient = useQueryClient();

  return useMutation<BulkSyncResult, Error, { connectionId: string; companyIds: string[] }>({
    mutationFn: async ({ connectionId, companyIds }) => {
      const res = await fetch("/api/integrations/sync/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, companyIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Bulk sync failed");
      }
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["sync-history"] });
    },
  });
}

export function useSyncStatus(companyId: string | undefined) {
  return useQuery<{ statuses: SyncStatus[] }>({
    queryKey: ["sync-status", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/sync/status?companyId=${companyId}`);
      if (!res.ok) throw new Error("Failed to fetch sync status");
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });
}

export function useSyncHistory() {
  return useQuery<{ logs: SyncLogEntry[] }>({
    queryKey: ["sync-history"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/sync/history?limit=20");
      if (!res.ok) throw new Error("Failed to fetch sync history");
      return res.json();
    },
    staleTime: 30_000,
  });
}

interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  provider: string;
  error?: string;
}

export function useConnectionHealthCheck() {
  const queryClient = useQueryClient();

  return useMutation<HealthCheckResult, Error, string>({
    mutationFn: async (connectionId: string) => {
      const res = await fetch("/api/integrations/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Health check failed");
      }
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });
}
