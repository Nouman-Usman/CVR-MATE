"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface SavedCompany {
  id: string;
  cvr: string;
  savedAt: string;
  company: Record<string, unknown>;
}

interface SavedResponse {
  results: SavedCompany[];
}

export function useSavedCompanies() {
  return useQuery<SavedResponse>({
    queryKey: ["saved-companies"],
    queryFn: async () => {
      const res = await fetch("/api/cvr/saved");
      if (!res.ok) throw new Error("Failed to fetch saved companies");
      return res.json();
    },
    staleTime: 2 * 60_000,
  });
}

export function useSavedCvrSet() {
  const { data } = useSavedCompanies();
  const set = new Set<string>();
  if (data?.results) {
    for (const s of data.results) set.add(s.cvr);
  }
  return set;
}

export function useSaveCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vat,
      name,
      rawData,
    }: {
      vat: string;
      name: string;
      rawData?: Record<string, unknown>;
    }) => {
      const res = await fetch("/api/cvr/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat, name, rawData }),
      });
      if (!res.ok) throw new Error("Failed to save company");
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-companies"] });
    },
  });
}

export function useUnsaveCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cvr: string) => {
      const res = await fetch(`/api/cvr/saved?cvr=${cvr}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove company");
      return res.json();
    },
    onMutate: async (cvr) => {
      await queryClient.cancelQueries({ queryKey: ["saved-companies"] });
      const prev = queryClient.getQueryData<SavedResponse>(["saved-companies"]);
      if (prev) {
        queryClient.setQueryData<SavedResponse>(["saved-companies"], {
          results: prev.results.filter((s) => s.cvr !== cvr),
        });
      }
      return { prev };
    },
    onError: (_err, _cvr, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["saved-companies"], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-companies"] });
    },
  });
}
