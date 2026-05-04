"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUpgradePrompt } from "./use-upgrade-prompt";

interface TodoSuggestion {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  dueInDays: number;
}

export interface SuggestTodosResponse {
  suggestions: TodoSuggestion[];
  error?: string;
}

export function useSuggestTodos() {
  const queryClient = useQueryClient();
  const { triggerUpgrade } = useUpgradePrompt();

  return useMutation<SuggestTodosResponse, Error & { upgrade?: boolean }, { vat: string; locale: string; companyData?: Record<string, unknown> }>({
    mutationFn: async ({ vat, locale, companyData }) => {
      const res = await fetch("/api/ai/suggest-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat, locale, companyData }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || "Failed to suggest tasks") as Error & { upgrade?: boolean };
        if (data.upgrade) err.upgrade = true;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (err) => {
      if (err.upgrade) triggerUpgrade("ai_task_suggest");
    },
  });
}
