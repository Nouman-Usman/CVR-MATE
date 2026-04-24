"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface LanguageResponse {
  language: "en" | "da";
}

export function useLanguagePreference() {
  return useQuery<LanguageResponse>({
    queryKey: ["language-preference"],
    queryFn: async () => {
      const res = await fetch("/api/user/language");
      if (!res.ok) return { language: "en" as const };
      return res.json();
    },
    staleTime: 10 * 60_000, // 10 minutes
  });
}

export function useLanguagePreferenceValue(): "en" | "da" {
  const { data } = useLanguagePreference();
  return data?.language ?? "en";
}

export function useSetLanguage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (language: "en" | "da") => {
      const res = await fetch("/api/user/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      if (!res.ok) throw new Error("Failed to update language preference");
      return res.json();
    },
    onMutate: async (language) => {
      await queryClient.cancelQueries({ queryKey: ["language-preference"] });
      const prev = queryClient.getQueryData<LanguageResponse>(["language-preference"]);
      queryClient.setQueryData<LanguageResponse>(["language-preference"], { language });
      return { prev };
    },
    onError: (_err, _val, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["language-preference"], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["language-preference"] });
    },
  });
}
