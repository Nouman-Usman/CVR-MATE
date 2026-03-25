"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface OutreachResponse {
  id?: string;
  subject?: string;
  message: string;
  followUp: string;
  error?: string;
}

interface OutreachParams {
  vat: string;
  type: "email" | "linkedin" | "phone_script";
  tone: "formal" | "casual";
  sellingPoint?: string;
  targetRole?: string;
  locale: string;
}

export interface SavedOutreachMessage {
  id: string;
  companyVat: string;
  companyName: string;
  type: string;
  tone: string;
  subject: string | null;
  message: string;
  followUp: string;
  createdAt: string;
}

export function useOutreach() {
  const queryClient = useQueryClient();

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
    onSuccess: (_data, variables) => {
      // Invalidate saved messages so the new one shows up in history
      queryClient.invalidateQueries({ queryKey: ["outreach-messages", variables.vat] });
    },
  });
}

export function useOutreachMessages(vat: string | undefined) {
  return useQuery<SavedOutreachMessage[]>({
    queryKey: ["outreach-messages", vat],
    queryFn: async () => {
      const res = await fetch(`/api/outreach?vat=${vat}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch messages");
      }
      const data = await res.json();
      return data.messages ?? [];
    },
    enabled: !!vat,
    staleTime: 0,
    retry: 2,
  });
}
