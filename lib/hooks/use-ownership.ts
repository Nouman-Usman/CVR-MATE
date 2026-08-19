"use client";

import { useQuery } from "@tanstack/react-query";

import type { OwnershipGraph } from "@/lib/ownership/types";

interface OwnershipResponse {
  graph?: OwnershipGraph;
  error?: string;
  upgrade?: boolean;
}

export interface OwnershipQueryParams {
  vat: string | undefined;
  up: number;
  down: number;
  /** Ask the server to skip management edges entirely — a cheaper payload than
   *  fetching them and hiding them client-side. */
  includeManagement: boolean;
}

/**
 * The ownership graph around a company.
 *
 * Depth is part of the query key, so changing a slider fetches rather than
 * re-filters: depth is a server concern (it decides which lookups happen),
 * while the panel's other toggles are pure client-side filtering over an
 * already-fetched graph.
 *
 * Cached for an hour like `useCompany` — the register changes slowly and a
 * graph costs several upstream lookups.
 */
export function useOwnership({ vat, up, down, includeManagement }: OwnershipQueryParams) {
  return useQuery<OwnershipResponse, Error & { upgrade?: boolean }>({
    queryKey: ["ownership", vat, up, down, includeManagement],
    queryFn: async () => {
      const params = new URLSearchParams({
        vat: vat ?? "",
        up: String(up),
        down: String(down),
      });
      if (!includeManagement) params.set("management", "0");

      const res = await fetch(`/api/cvr/ownership?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = new Error(data.error || "Failed to load ownership graph") as Error & {
          upgrade?: boolean;
        };
        // Surfaced so the tab can render the upgrade state rather than an error.
        err.upgrade = data.upgrade === true;
        throw err;
      }
      return res.json();
    },
    enabled: !!vat,
    // A 403 is a plan decision, not a blip — retrying just burns requests.
    retry: (count, error) => !error.upgrade && count < 2,
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
  });
}
