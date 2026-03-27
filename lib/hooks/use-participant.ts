"use client";

import { useQuery } from "@tanstack/react-query";
import type { CvrParticipant } from "@/lib/cvr-api";

interface ParticipantResponse {
  participant?: CvrParticipant;
  error?: string;
}

export function useParticipant(id: string | undefined) {
  return useQuery<ParticipantResponse>({
    queryKey: ["participant", id],
    queryFn: async () => {
      const res = await fetch(`/api/cvr/participant?id=${id}`);
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
