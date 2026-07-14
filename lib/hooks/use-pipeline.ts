"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface BoardStage {
  id: string;
  name: string;
  position: number;
  color: string | null;
  isWon: boolean;
  isLost: boolean;
}

export interface BoardDeal {
  id: string;
  title: string;
  amount: string | null;
  currency: string;
  stageId: string;
  status: string;
  stageChangedAt: string | null;
  closeDate: string | null;
  company: { id: string; vat: string; name: string; industryName: string | null } | null;
  assignedUser: { id: string; name: string | null; image: string | null } | null;
  primaryContact: { id: string; name: string } | null;
}

export interface BoardColumn {
  stage: BoardStage;
  deals: BoardDeal[];
}

export interface BoardResponse {
  pipeline: { id: string; name: string; isDefault: boolean };
  columns: BoardColumn[];
}

export interface PipelineSummary {
  id: string;
  name: string;
  isDefault: boolean;
  stages: BoardStage[];
}

// ─── Pipelines list ─────────────────────────────────────────────────────────

export function usePipelines() {
  return useQuery<{ pipelines: PipelineSummary[] }>({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const res = await fetch("/api/pipelines");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch pipelines");
      }
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useCreatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create pipeline");
      return data;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["pipelines"] }),
  });
}

export function useUpdatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      isDefault,
    }: {
      id: string;
      name?: string;
      isDefault?: boolean;
    }) => {
      const res = await fetch(`/api/pipelines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, isDefault }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update pipeline");
      return data;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["pipelines"] }),
  });
}

export function useDeletePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/pipelines/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete pipeline");
      return data;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["pipelines"] }),
  });
}

// ─── Board ──────────────────────────────────────────────────────────────────

const boardKey = (pipelineId: string) => ["board", pipelineId] as const;

export function useBoard(pipelineId: string | undefined) {
  return useQuery<BoardResponse>({
    queryKey: boardKey(pipelineId ?? "none"),
    enabled: !!pipelineId,
    queryFn: async () => {
      const res = await fetch(`/api/pipelines/${pipelineId}/board`);
      if (!res.ok) throw new Error("Failed to fetch board");
      return res.json();
    },
    staleTime: 15_000,
  });
}

/** Move a deal to a new stage with optimistic board reordering. */
export function useMoveDeal(pipelineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to move deal");
      return data;
    },
    onMutate: async ({ dealId, stageId }) => {
      const key = boardKey(pipelineId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BoardResponse>(key);
      if (prev) {
        let moved: BoardDeal | undefined;
        const stripped = prev.columns.map((col) => ({
          ...col,
          deals: col.deals.filter((d) => {
            if (d.id === dealId) {
              moved = { ...d, stageId };
              return false;
            }
            return true;
          }),
        }));
        if (moved) {
          const next = stripped.map((col) =>
            col.stage.id === stageId ? { ...col, deals: [moved!, ...col.deals] } : col
          );
          qc.setQueryData<BoardResponse>(key, { ...prev, columns: next });
        }
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(boardKey(pipelineId), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: boardKey(pipelineId) }),
  });
}

export function useCreateDeal(pipelineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, pipelineId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create deal");
      return data;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: boardKey(pipelineId) }),
  });
}
