"use client";

import { useEffect, useState } from "react";
import { MessageList, type ChatMessage } from "./message-list";
import { ChatInput } from "./chat-input";
import { MaskedPreviewCard } from "./masked-preview-card";
import { RecommendationBanner } from "./recommendation-banner";
import { InlineSignupForm } from "./inline-signup-form";
import type { PlanId } from "@/lib/stripe/plans";
import type { MaskedCompanyPreview } from "@/lib/chat-landing/masking";

type Phase = "loading" | "chatting" | "recommended" | "signup" | "done";

const SESSION_STORAGE_KEY = "chat-landing-session-id";

const INITIAL_ASSISTANT_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi! Tell me a bit about your business — what do you sell, and who are you trying to reach in Denmark?",
};

// Concrete ways in for a first-time visitor — each is a real opening message.
const STARTER_PROMPTS = [
  "We sell B2B software to Danish manufacturers",
  "Recruitment agency looking for growing startups",
  "I want to find companies by CVR number",
];

export function ChatLandingApp() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_ASSISTANT_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [recommendedPlan, setRecommendedPlan] = useState<PlanId | null>(null);
  const [preview, setPreview] = useState<MaskedCompanyPreview[]>([]);
  const [signupEmail, setSignupEmail] = useState("");
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

        {/* Starter prompts — only before the visitor has said anything */}
        {phase === "chatting" && messages.length === 1 && !isTyping && (
          <div className="flex flex-wrap gap-2 pt-1">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={!sessionId}
                onClick={() => sendMessage(prompt)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[13px] text-slate-300 transition-colors hover:border-cyan-400/40 hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {phase === "done" && (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.05] p-5">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
              </span>
              Account created
            </p>
            <p className="mt-2 text-[15px] font-semibold text-white">Check your email to activate your trial</p>
            <p className="mt-1 text-sm text-slate-400">
              We sent a verification link to{" "}
              <span className="font-medium text-slate-200">{signupEmail}</span>. Confirm it and your
              14-day trial starts — no charge today.
            </p>
          </div>
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
            onSignedUp={({ email }) => {
              // Email verification is required, so the user is not logged in yet —
              // we can't push them into Stripe checkout here. Confirm the account
              // and route them to verify; the trial is recorded server-side.
              setSignupEmail(email);
              setPhase("done");
            }}
          />
        )}
      </MessageList>

      {phase === "chatting" && <ChatInput onSend={sendMessage} disabled={isTyping || !sessionId} />}
    </div>
  );
}
