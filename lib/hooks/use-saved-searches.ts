"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface SavedSearch {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
}

interface SavedSearchesResponse {
  results: SavedSearch[];
}

export function useSavedSearches() {
  return useQuery<SavedSearchesResponse>({
    queryKey: ["saved-searches"],
    queryFn: async () => {
      const res = await fetch("/api/saved-searches");
      if (!res.ok) throw new Error("Failed to fetch saved searches");
      return res.json();
    },
    staleTime: 2 * 60_000,
  });
}

export function useSaveSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; filters: Record<string, string> }) => {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save search");
      return res.json();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
}

export function useDeleteSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/saved-searches?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete search");
      return res.json();
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["saved-searches"] });
      const prev = qc.getQueryData<SavedSearchesResponse>(["saved-searches"]);
      if (prev) {
        qc.setQueryData<SavedSearchesResponse>(["saved-searches"], {
          results: prev.results.filter((s) => s.id !== id),
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["saved-searches"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
}
