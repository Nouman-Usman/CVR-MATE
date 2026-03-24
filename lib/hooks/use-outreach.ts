"use client";

import { useMutation } from "@tanstack/react-query";

interface OutreachResponse {
  subject?: string;
  message: string;
  followUp: string;
  error?: string;
}

interface OutreachParams {
  vat: string;
  type: "email" | "linkedin" | "phone_script";
  tone: "formal" | "casual";
  sellingPoint: string;
  targetRole?: string;
  locale: string;
}

export function useOutreach() {
  return useMutation<OutreachResponse, Error, OutreachParams>({
    mutationFn: async (params) => {
      const res = await fetch("/api/ai/draft-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate outreach");
      return data;
    },
  });
}
