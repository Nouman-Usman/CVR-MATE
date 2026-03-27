"use client";

import { useQuery } from "@tanstack/react-query";
import type { CvrParticipant } from "@/lib/cvr-api";

interface ParticipantResponse {
  participant?: CvrParticipant;
  error?: string;
}

export function useParticipant(id: string | undefined, fromVat?: string) {
  return useQuery<ParticipantResponse>({
    queryKey: ["participant", id, fromVat],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("id", id!);
      if (fromVat) params.set("fromVat", fromVat);
      const res = await fetch(`/api/cvr/participant?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load participant");
      }
      return res.json();
    },
    enabled: !!id,
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
  });
}
