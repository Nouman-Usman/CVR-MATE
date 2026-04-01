"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface SavedCompany {
  id: string;
  cvr: string;
  note: string | null;
  tags: string[];
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
      note,
    }: {
      vat: string;
      name: string;
      rawData?: Record<string, unknown>;
      note?: string;
    }) => {
      const res = await fetch("/api/cvr/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat, name, rawData, note }),
      });
      if (!res.ok) throw new Error("Failed to save company");
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-companies"] });
    },
  });
}

export function useUpdateSavedNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cvr, note }: { cvr: string; note: string }) => {
      const res = await fetch("/api/cvr/saved", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvr, note }),
      });
      if (!res.ok) throw new Error("Failed to update note");
      return res.json();
    },
    onMutate: async ({ cvr, note }) => {
      await queryClient.cancelQueries({ queryKey: ["saved-companies"] });
      const prev = queryClient.getQueryData<SavedResponse>(["saved-companies"]);
      if (prev) {
        queryClient.setQueryData<SavedResponse>(["saved-companies"], {
          results: prev.results.map((s) =>
            s.cvr === cvr ? { ...s, note: note.trim() || null } : s
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["saved-companies"], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-companies"] });
    },
  });
}

export function useUpdateSavedTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cvr, tags }: { cvr: string; tags: string[] }) => {
      const res = await fetch("/api/cvr/saved", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvr, tags }),
      });
      if (!res.ok) throw new Error("Failed to update tags");
      return res.json();
    },
    onMutate: async ({ cvr, tags }) => {
      await queryClient.cancelQueries({ queryKey: ["saved-companies"] });
      const prev = queryClient.getQueryData<SavedResponse>(["saved-companies"]);
      if (prev) {
        queryClient.setQueryData<SavedResponse>(["saved-companies"], {
          results: prev.results.map((s) =>
            s.cvr === cvr ? { ...s, tags } : s
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["saved-companies"], context.prev);
      }
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
