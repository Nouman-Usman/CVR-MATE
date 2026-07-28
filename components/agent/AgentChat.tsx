"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowUp, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";
import { useSearchAgent } from "@/lib/hooks/use-search-agent";
import { fetchAgentSession } from "@/lib/hooks/use-agent-sessions";
import { AgentMessage } from "./AgentMessage";
import { ConfirmCard } from "./ConfirmCard";
import { ThreadSidebar } from "./ThreadSidebar";

export function AgentChat() {
  const { t } = useLanguage();
  const a = t.agent;
  const agent = useSearchAgent();
  const { messages, status, error, pendingConfirm, sendMessage, confirm, reset, hydrate, sessionId } = agent;

  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingConfirm, status]);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || status === "streaming") return;
    setInput("");
    await sendMessage(text);
  }, [input, status, sendMessage]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const selectThread = useCallback(
    async (id: string) => {
      try {
        const loaded = await fetchAgentSession(id);
        hydrate(loaded.session.id, loaded.messages);
      } catch {
        /* ignore load failure */
      }
    },
    [hydrate]
  );

  const isEmpty = messages.length === 0;
  const showThinking =
    status === "streaming" &&
    (messages.length === 0 || messages[messages.length - 1].role === "user" ||
      (messages[messages.length - 1].role === "assistant" && !messages[messages.length - 1].text));

  return (
    <div className="flex h-[calc(100dvh-8rem)] overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <ThreadSidebar activeId={sessionId} onSelect={selectThread} onNewChat={reset} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Transcript */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {isEmpty ? (
              <EmptyState onPick={(p) => setInput(p)} />
            ) : (
              <div className="space-y-5">
                {messages.map((m, idx) => (
                  <AgentMessage
                    key={m.id}
                    message={m}
                    streaming={status === "streaming" && idx === messages.length - 1 && m.role === "assistant"}
                  />
                ))}
                {pendingConfirm && <ConfirmCard pending={pendingConfirm} onDecision={confirm} />}
                {showThinking && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {a.thinking}
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-background/80 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl px-4 py-3">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-blue-300">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={a.placeholder}
                disabled={status === "streaming"}
                className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!input.trim() || status === "streaming"}
                aria-label={a.send}
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl text-white transition-colors",
                  !input.trim() || status === "streaming"
                    ? "cursor-not-allowed bg-muted text-muted-foreground"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {status === "streaming" ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
              </button>
            </div>
            <p className="mt-1.5 px-1 text-center text-[11px] text-muted-foreground">{a.disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  const { t } = useLanguage();
  const a = t.agent;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-cyan-500 text-white shadow-lg">
        <Sparkles className="size-7" />
      </div>
      <h1 className="mt-4 text-2xl font-bold text-foreground">{a.title}</h1>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{a.subtitle}</p>
      <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {a.starters.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-xl border border-border bg-card p-3 text-left text-sm text-foreground/90 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
