"use client";

import { useEffect, useState } from "react";
import { MessageList, type ChatMessage } from "./message-list";
import { ChatInput } from "./chat-input";
import { MaskedPreviewCard } from "./masked-preview-card";
import { RecommendationBanner } from "./recommendation-banner";
import { InlineSignupForm } from "./inline-signup-form";
import type { PlanId } from "@/lib/stripe/plans";
import type { MaskedCompanyPreview } from "@/lib/chat-landing/masking";

const MONTHLY_PRICE_ID_BY_PLAN: Partial<Record<PlanId, string | undefined>> = {
  starter: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID,
  professional: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
  enterprise: process.env.NEXT_PUBLIC_STRIPE_ENT_MONTHLY_PRICE_ID,
};

type Phase = "loading" | "chatting" | "recommended" | "signup" | "done";

const SESSION_STORAGE_KEY = "chat-landing-session-id";

const INITIAL_ASSISTANT_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi! Tell me a bit about your business — what do you sell, and who are you trying to reach in Denmark?",
};

export function ChatLandingApp() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_ASSISTANT_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [recommendedPlan, setRecommendedPlan] = useState<PlanId | null>(null);
  const [preview, setPreview] = useState<MaskedCompanyPreview[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const cached = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (cached) {
      setSessionId(cached);
      setPhase("chatting");
      return;
    }

    fetch("/api/chat-landing/session", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.sessionId) {
          sessionStorage.setItem(SESSION_STORAGE_KEY, data.sessionId);
          setSessionId(data.sessionId);
        }
        setPhase("chatting");
      })
      .catch(() => setPhase("chatting"));
  }, []);

  const sendMessage = async (text: string) => {
    if (!sessionId) return;
    setError("");
    const updated = [...messages, { role: "user" as const, content: text }];
    setMessages(updated);
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat-landing/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, transcript: updated }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setMessages([...updated, { role: "assistant", content: data.assistantMessage }]);

      if (data.readyToRecommend) {
        setRecommendedPlan(data.recommendedPlan);
        setPreview(data.preview ?? []);
        setPhase("recommended");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsTyping(false);
    }
  };

  if (phase === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center font-mono text-sm text-slate-500">
        Connecting...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      <MessageList messages={messages} isTyping={isTyping}>
        {error && <p className="text-sm text-red-400">{error}</p>}

        {phase === "done" && (
          <p className="font-mono text-sm text-slate-400 animate-pulse">
            &gt; setting up your trial, redirecting to checkout...
          </p>
        )}

        {phase === "recommended" && recommendedPlan && sessionId && (
          <div className="space-y-4">
            {preview.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {preview.map((company) => (
                  <MaskedPreviewCard key={company.vat} company={company} />
                ))}
              </div>
            )}
            <RecommendationBanner planId={recommendedPlan} onContinue={() => setPhase("signup")} />
          </div>
        )}

        {phase === "signup" && sessionId && (
          <InlineSignupForm
            sessionId={sessionId}
            onSignedUp={async () => {
              setPhase("done");
              const priceId = recommendedPlan ? MONTHLY_PRICE_ID_BY_PLAN[recommendedPlan] : undefined;
              if (!priceId) {
                window.location.href = "/settings";
                return;
              }
              try {
                const res = await fetch("/api/stripe/checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ priceId }),
                });
                const data = await res.json();
                window.location.href = data.url ?? "/settings";
              } catch {
                window.location.href = "/settings";
              }
            }}
          />
        )}
      </MessageList>

      {phase === "chatting" && <ChatInput onSend={sendMessage} disabled={isTyping || !sessionId} />}
    </div>
  );
}
