"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type EmailClient = "default" | "gmail" | "outlook";

interface EmailClientResponse {
  emailClient: EmailClient;
}

export function useEmailClient() {
  return useQuery<EmailClientResponse>({
    queryKey: ["email-client-preference"],
    queryFn: async () => {
      const res = await fetch("/api/preferences/email-client");
      if (!res.ok) return { emailClient: "default" as EmailClient };
      return res.json();
    },
    staleTime: 10 * 60_000, // 10 minutes — rarely changes
  });
}

export function useEmailClientValue(): EmailClient {
  const { data } = useEmailClient();
  return data?.emailClient ?? "default";
}

export function useSetEmailClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (emailClient: EmailClient) => {
      const res = await fetch("/api/preferences/email-client", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailClient }),
      });
      if (!res.ok) throw new Error("Failed to update preference");
      return res.json();
    },
    onMutate: async (emailClient) => {
      await queryClient.cancelQueries({ queryKey: ["email-client-preference"] });
      const prev = queryClient.getQueryData<EmailClientResponse>(["email-client-preference"]);
      queryClient.setQueryData<EmailClientResponse>(["email-client-preference"], {
        emailClient,
      });
      return { prev };
    },
    onError: (_err, _val, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["email-client-preference"], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["email-client-preference"] });
    },
  });
}

/** Build the correct compose URL based on user's preferred email client */
export function buildComposeUrl(
  client: EmailClient,
  to: string | null | undefined,
  subject: string | null | undefined,
  body: string
): string {
  const encodedTo = to ?? "";
  const encodedSubject = subject ?? "";

  switch (client) {
    case "gmail":
      return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(encodedTo)}&su=${encodeURIComponent(encodedSubject)}&body=${encodeURIComponent(body)}`;

    case "outlook":
      return `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(encodedTo)}&subject=${encodeURIComponent(encodedSubject)}&body=${encodeURIComponent(body)}`;

    case "default":
    default: {
      // mailto: URI — uses %20 not + for spaces (RFC 6068)
      const parts: string[] = [];
      if (encodedSubject) parts.push(`subject=${encodeURIComponent(encodedSubject)}`);
      parts.push(`body=${encodeURIComponent(body)}`);
      return `mailto:${encodeURIComponent(encodedTo)}?${parts.join("&")}`;
    }
  }
}
