"use client";

import { useCallback, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { useUpgradePrompt } from "@/lib/hooks/use-upgrade-prompt";
import type { StreamEvent } from "@/lib/agent/types";

export type ToolStatus = "running" | "done" | "error";

export interface ToolTraceEntry {
  id: string;
  name: string;
  input: unknown;
  status: ToolStatus;
  summary?: string;
  display?: unknown;
}

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools: ToolTraceEntry[];
}

export interface PendingConfirm {
  toolUseId: string;
  name: string;
  input: unknown;
  humanSummary: string;
}

export type AgentStatus = "idle" | "streaming" | "awaiting_confirmation" | "error";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

/** Parse the SSE-framed POST body, dispatching each event. */
async function readStream(res: Response, onEvent: (e: StreamEvent) => void): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        onEvent(JSON.parse(json) as StreamEvent);
      } catch {
        /* ignore malformed frame */
      }
    }
  }
}

export interface UseSearchAgent {
  messages: UiMessage[];
  status: AgentStatus;
  error: string | null;
  sessionId: string | null;
  pendingConfirm: PendingConfirm | null;
  sendMessage: (text: string) => Promise<void>;
  confirm: (approved: boolean) => Promise<void>;
  reset: () => void;
  hydrate: (sessionId: string, messages: UiMessage[]) => void;
}

/**
 * Client runtime for the search agent. Manages a live turn: POSTs to
 * /api/agent/search, reads the streamed events, and reduces them into a
 * message list + tool trace + pending-confirmation state.
 */
export function useSearchAgent(): UseSearchAgent {
  const { locale } = useLanguage();
  const { triggerUpgrade } = useUpgradePrompt();

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // The assistant message currently receiving stream events.
  const currentAssistantId = useRef<string | null>(null);

  const setSession = useCallback((id: string) => {
    sessionIdRef.current = id;
    setSessionId(id);
  }, []);

  const ensureAssistantMessage = useCallback((): string => {
    if (currentAssistantId.current) return currentAssistantId.current;
    const id = newId();
    currentAssistantId.current = id;
    setMessages((prev) => [...prev, { id, role: "assistant", text: "", tools: [] }]);
    return id;
  }, []);

  const patchAssistant = useCallback(
    (id: string, fn: (m: UiMessage) => UiMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
    },
    []
  );

  const handleEvent = useCallback(
    (e: StreamEvent) => {
      switch (e.type) {
        case "session":
          setSession(e.sessionId);
          break;
        case "text": {
          const id = ensureAssistantMessage();
          patchAssistant(id, (m) => ({ ...m, text: m.text + e.delta }));
          break;
        }
        case "tool_call": {
          const id = ensureAssistantMessage();
          patchAssistant(id, (m) => ({
            ...m,
            tools: [...m.tools, { id: e.id, name: e.name, input: e.input, status: "running" }],
          }));
          break;
        }
        case "tool_result": {
          const id = ensureAssistantMessage();
          patchAssistant(id, (m) => ({
            ...m,
            tools: m.tools.map((t) =>
              t.id === e.id
                ? { ...t, status: e.isError ? "error" : "done", summary: e.summary, display: e.display }
                : t
            ),
          }));
          break;
        }
        case "interrupt":
          setPendingConfirm({
            toolUseId: e.toolUseId,
            name: e.name,
            input: e.input,
            humanSummary: e.humanSummary,
          });
          setStatus("awaiting_confirmation");
          break;
        case "message_done":
          break;
        case "error":
          setError(e.message);
          setStatus("error");
          if (e.upgrade) triggerUpgrade("ai_usage");
          break;
        case "done":
          setStatus("idle");
          break;
      }
    },
    [ensureAssistantMessage, patchAssistant, setSession, triggerUpgrade]
  );

  const runRequest = useCallback(
    async (body: Record<string, unknown>) => {
      setError(null);
      currentAssistantId.current = null;
      setStatus("streaming");
      try {
        const res = await fetch("/api/agent/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Request failed" }));
          setError(data.error ?? "Request failed");
          setStatus("error");
          if (data.upgrade) triggerUpgrade("ai_usage");
          return;
        }
        await readStream(res, handleEvent);
        // If the stream ended without a terminal event, settle to idle.
        setStatus((s) => (s === "streaming" ? "idle" : s));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        setStatus("error");
      }
    },
    [handleEvent, triggerUpgrade]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === "streaming") return;
      setMessages((prev) => [...prev, { id: newId(), role: "user", text: trimmed, tools: [] }]);
      currentAssistantId.current = null;
      await runRequest({
        sessionId: sessionIdRef.current ?? undefined,
        message: trimmed,
        locale,
      });
    },
    [locale, runRequest, status]
  );

  const confirm = useCallback(
    async (approved: boolean) => {
      const pending = pendingConfirm;
      if (!pending || !sessionIdRef.current) return;
      setPendingConfirm(null);
      // Continue streaming into the same assistant bubble that paused.
      await runRequest({
        sessionId: sessionIdRef.current,
        confirm: { toolUseId: pending.toolUseId, approved },
        locale,
      });
    },
    [pendingConfirm, locale, runRequest]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setStatus("idle");
    setError(null);
    setPendingConfirm(null);
    currentAssistantId.current = null;
    sessionIdRef.current = null;
    setSessionId(null);
  }, []);

  const hydrate = useCallback((id: string, msgs: UiMessage[]) => {
    setMessages(msgs);
    setStatus("idle");
    setError(null);
    setPendingConfirm(null);
    currentAssistantId.current = null;
    sessionIdRef.current = id;
    setSessionId(id);
  }, []);

  return { messages, status, error, sessionId, pendingConfirm, sendMessage, confirm, reset, hydrate };
}
