"use client";

import { useMutation } from "@tanstack/react-query";

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
  return useMutation<SuggestTodosResponse, Error, { vat: string; locale: string; companyData?: Record<string, unknown> }>({
    mutationFn: async ({ vat, locale, companyData }) => {
      const res = await fetch("/api/ai/suggest-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat, locale, companyData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to suggest tasks");
      return data;
    },
  });
}
