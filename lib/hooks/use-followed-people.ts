"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface FollowedPerson {
  id: string;
  participantNumber: string;
  personName: string;
  note: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
}

interface FollowedResponse {
  results: FollowedPerson[];
}

export function useFollowedPeople() {
  return useQuery<FollowedResponse>({
    queryKey: ["followed-people"],
    queryFn: async () => {
      const res = await fetch("/api/followed-people");
      if (!res.ok) throw new Error("Failed to fetch followed people");
      return res.json();
    },
    staleTime: 2 * 60_000,
  });
}

export function useFollowedParticipantSet() {
  const { data } = useFollowedPeople();
  const set = new Set<string>();
  if (data?.results) {
    for (const f of data.results) set.add(f.participantNumber);
  }
  return set;
}

export function useFollowPerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      participantNumber,
      personName,
      fromVat,
    }: {
      participantNumber: string;
      personName: string;
      fromVat?: string;
    }) => {
      const res = await fetch("/api/followed-people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantNumber, personName, fromVat }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = new Error(data.error || "Failed to follow person") as Error & {
          upgrade?: boolean;
        };
        if (data.upgrade) err.upgrade = true;
        throw err;
      }
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["followed-people"] });
    },
  });
}

export function useUnfollowPerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (participantNumber: string) => {
      const res = await fetch(
        `/api/followed-people?participantNumber=${participantNumber}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to unfollow person");
      return res.json();
    },
    onMutate: async (participantNumber) => {
      await queryClient.cancelQueries({ queryKey: ["followed-people"] });
      const prev = queryClient.getQueryData<FollowedResponse>(["followed-people"]);
      if (prev) {
        queryClient.setQueryData<FollowedResponse>(["followed-people"], {
          results: prev.results.filter(
            (f) => f.participantNumber !== participantNumber
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _pn, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["followed-people"], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["followed-people"] });
    },
  });
}
