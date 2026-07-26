"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageList, type ChatMessage } from "./message-list";
import { ChatInput } from "./chat-input";
import { SuggestedReplies } from "./suggested-replies";
import { MaskedPreviewCard } from "./masked-preview-card";
import { RecommendationBanner } from "./recommendation-banner";
import { InlineSignupForm } from "./inline-signup-form";
import { useLanguage } from "@/lib/i18n/language-context";
import type { PlanId } from "@/lib/stripe/plans";
import type { MaskedCompanyPreview } from "@/lib/chat-landing/masking";

type Phase = "loading" | "chatting" | "recommended" | "signup" | "done";

const SESSION_STORAGE_KEY = "chat-landing-session-id";

// Roughly how many questions the intake asks — drives the progress meter only.
const INTAKE_QUESTIONS = 5;

export function ChatLandingApp({ seed }: { seed?: string }) {
  const { t, locale } = useLanguage();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  // `messages` holds only the real turns; the opener is derived from `t` so it
  // re-localises instantly when the visitor flips the language toggle.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recommendedPlan, setRecommendedPlan] = useState<PlanId | null>(null);
  const [preview, setPreview] = useState<MaskedCompanyPreview[]>([]);
  const [signupEmail, setSignupEmail] = useState("");
  const [error, setError] = useState("");

  // Always current locale, readable from the mount-only session effect without
  // making that effect re-run (which would spawn duplicate sessions).
  const localeRef = useRef(locale);
  localeRef.current = locale;

  useEffect(() => {
    const cached = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (cached) {
      setSessionId(cached);
      setPhase("chatting");
      return;
    }

    fetch("/api/chat-landing/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: localeRef.current }),
    })
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

  const sendMessage = useCallback(async (text: string) => {
    if (!sessionId) return;
    setError("");
    const updated = [...messages, { role: "user" as const, content: text }];
    setMessages(updated);
    setSuggestions([]);
    setIsTyping(true);

    // The AI's opener is derived, so prepend it to the transcript we send for
    // context; `locale` tells the model which language to answer in.
    const transcript = [{ role: "assistant" as const, content: t.chat.intro }, ...updated];

    try {
      const res = await fetch("/api/chat-landing/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, transcript, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.chat.error);

      setMessages([...updated, { role: "assistant", content: data.assistantMessage }]);
      setSuggestions(data.suggestedReplies ?? []);

      if (data.readyToRecommend) {
        setRecommendedPlan(data.recommendedPlan);
        setPreview(data.preview ?? []);
        setPhase("recommended");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.chat.error);
    } finally {
      setIsTyping(false);
    }
  }, [sessionId, messages, locale, t]);

  // Seeded from the marketing hero (/start?q=…): send that opener once the
  // session is live, so the visitor lands already one turn into the chat.
  const seedSentRef = useRef(false);
  useEffect(() => {
    if (seed && sessionId && phase === "chatting" && !seedSentRef.current) {
      seedSentRef.current = true;
      sendMessage(seed);
    }
  }, [seed, sessionId, phase, sendMessage]);

  if (phase === "loading") {
    return (
      <div className="flex h-full flex-1 items-center justify-center font-mono text-sm text-slate-500">
        {t.chat.connecting}
      </div>
    );
  }

  // Opener + real turns, for display and scroll.
  const displayMessages: ChatMessage[] = [
    { role: "assistant", content: t.chat.intro },
    ...messages,
  ];
  // Before the first answer, offer localized starter prompts; after that, the
  // AI's own (already localized) suggestions.
  const displayedSuggestions = messages.length === 0 ? [...t.chat.starterPrompts] : suggestions;

  const userTurns = messages.filter((m) => m.role === "user").length;
  const progress = phase === "chatting" ? Math.min(userTurns / INTAKE_QUESTIONS, 0.92) : 1;
  const showProgress = phase === "chatting" || phase === "recommended";

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      {/* Intake meter — an ambient sense of progress, no scary "5 questions" */}
      {showProgress && (
        <div className="shrink-0 px-4 pt-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">
              {t.chat.buildingProfile}
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

      <MessageList messages={displayMessages} isTyping={isTyping}>
        {error && <p className="text-sm text-red-400">{error}</p>}

        {phase === "chatting" && !isTyping && (
          <SuggestedReplies options={displayedSuggestions} onPick={sendMessage} disabled={!sessionId} />
        )}

        {phase === "done" && (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-5">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
              </span>
              {t.chat.done.badge}
            </p>
            <p className="mt-2 text-[15px] font-semibold text-white">{t.chat.done.title}</p>
            <p className="mt-1 text-sm text-slate-400">
              {t.chat.done.body}{" "}
              <span className="font-medium text-slate-200">{signupEmail}</span>
              {t.chat.done.bodyAfter}
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
