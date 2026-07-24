"use client";

import { useEffect, useState } from "react";
import { MessageList, type ChatMessage } from "./message-list";
import { ChatInput } from "./chat-input";
import { SuggestedReplies } from "./suggested-replies";
import { MaskedPreviewCard } from "./masked-preview-card";
import { RecommendationBanner } from "./recommendation-banner";
import { InlineSignupForm } from "./inline-signup-form";
import type { PlanId } from "@/lib/stripe/plans";
import type { MaskedCompanyPreview } from "@/lib/chat-landing/masking";

type Phase = "loading" | "chatting" | "recommended" | "signup" | "done";

const SESSION_STORAGE_KEY = "chat-landing-session-id";

// Roughly how many questions the intake asks — drives the progress meter only.
const INTAKE_QUESTIONS = 5;

const INITIAL_ASSISTANT_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi! Tell me a bit about your business — what do you sell, and who are you trying to reach in Denmark?",
};

// Seed replies for the opening question, before the AI starts suggesting its own.
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
  const [suggestions, setSuggestions] = useState<string[]>(STARTER_PROMPTS);
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
    // Chips vanish the moment an answer is chosen or typed, Claude-style.
    setSuggestions([]);
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
      setSuggestions(data.suggestedReplies ?? []);

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
      <div className="flex h-full flex-1 items-center justify-center font-mono text-sm text-slate-500">
        Connecting…
      </div>
    );
  }

  const userTurns = messages.filter((m) => m.role === "user").length;
  const progress =
    phase === "chatting" ? Math.min(userTurns / INTAKE_QUESTIONS, 0.92) : 1;
  const showProgress = phase === "chatting" || phase === "recommended";

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      {/* Intake meter — an ambient sense of progress, no scary "5 questions" */}
      {showProgress && (
        <div className="shrink-0 px-4 pt-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">
              Building your profile
            </span>
            <div className="h-px flex-1 overflow-hidden bg-white/8">
              <div
                className="h-full bg-linear-to-r from-blue-500 to-cyan-400 transition-[width] duration-700 ease-out"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <MessageList messages={messages} isTyping={isTyping}>
        {error && <p className="text-sm text-red-400">{error}</p>}

        {phase === "chatting" && !isTyping && (
          <SuggestedReplies options={suggestions} onPick={sendMessage} disabled={!sessionId} />
        )}

        {phase === "done" && (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-5">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
              </span>
              Account created
            </p>
            <p className="mt-2 text-[15px] font-semibold text-white">
              Your 14-day trial is active — no charge today
            </p>
            <p className="mt-1 text-sm text-slate-400">
              We sent a verification link to{" "}
              <span className="font-medium text-slate-200">{signupEmail}</span>. Confirm it to log in
              and start using CVR-MATE.
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
