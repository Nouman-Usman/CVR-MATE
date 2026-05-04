"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUpgradePrompt } from "./use-upgrade-prompt";

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
  companyData?: Record<string, unknown>;
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
  const { triggerUpgrade } = useUpgradePrompt();

  return useMutation<OutreachResponse, Error & { upgrade?: boolean }, OutreachParams>({
    mutationFn: async (params) => {
      const res = await fetch("/api/ai/draft-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || "Failed to generate outreach") as Error & { upgrade?: boolean };
        if (data.upgrade) err.upgrade = true;
        throw err;
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["outreach-messages", variables.vat] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (err, variables) => {
      if (err.upgrade) {
        const featureKey =
          variables.type === "email" ? "email_draft"
          : variables.type === "linkedin" ? "linkedin_draft"
          : "phone_draft";
        triggerUpgrade(featureKey);
      }
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
