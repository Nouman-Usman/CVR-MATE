"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface FollowedCompany {
  id: string;
  cvr: string;
  companyName: string;
  note: string | null;
  /** Null until the first poll — that run seeds silently and notifies nothing. */
  lastCheckedAt: string | null;
  followerId: string;
  createdAt: string;
}

const KEY = ["followed-companies"];

/** The current workspace's active company subscriptions. */
export function useFollowedCompanies() {
  return useQuery<{ results: FollowedCompany[] }>({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetch("/api/followed-companies");
      if (!res.ok) throw new Error("Failed to load followed companies");
      return res.json();
    },
    staleTime: 60_000,
  });
}

/** Set of followed CVRs, for a button that has to know its own state. */
export function useFollowedCvrSet(): Set<string> {
  const { data } = useFollowedCompanies();
  return new Set((data?.results ?? []).map((f) => f.cvr));
}

export function useFollowCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { cvr: string; companyName: string; note?: string }) => {
      const res = await fetch("/api/followed-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Carried through so the caller can raise the upgrade prompt rather
        // than showing a generic failure for a plan decision.
        const err = new Error(data.error || "Failed to follow company") as Error & {
          upgrade?: boolean;
        };
        err.upgrade = data.upgrade === true;
        throw err;
      }
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUnfollowCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cvr: string) => {
      const res = await fetch(`/api/followed-companies?cvr=${encodeURIComponent(cvr)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to unfollow company");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
