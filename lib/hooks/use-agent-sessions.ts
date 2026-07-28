"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ToolTraceEntry, UiMessage } from "./use-search-agent";

export interface AgentSessionSummary {
  id: string;
  title: string | null;
  status: string;
  updatedAt: string;
}

/** Minimal view of a stored Anthropic content block (transcript is JSON). */
interface RawBlock {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  is_error?: boolean;
  content?: unknown;
}

interface StoredRow {
  role: "user" | "assistant" | "tool_result";
  content: RawBlock[];
}

function rid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

function summarize(content: unknown): string | undefined {
  if (typeof content === "string") {
    return content.length > 80 ? `${content.slice(0, 80)}…` : content;
  }
  return undefined;
}

/**
 * Rebuild a persisted transcript into the UiMessage[] the chat renders.
 * tool_use blocks on an assistant row become tool-trace entries; the following
 * tool_result row's blocks resolve them by tool_use_id.
 */
export function storedToUiMessages(rows: StoredRow[]): UiMessage[] {
  const out: UiMessage[] = [];
  const toolIndex = new Map<string, ToolTraceEntry>();
  for (const row of rows) {
    const blocks = Array.isArray(row.content) ? row.content : [];
    if (row.role === "user") {
      const text = blocks
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");
      if (text) out.push({ id: rid(), role: "user", text, tools: [] });
    } else if (row.role === "assistant") {
      let text = "";
      const tools: ToolTraceEntry[] = [];
      for (const b of blocks) {
        if (b.type === "text") text += b.text ?? "";
        else if (b.type === "tool_use" && b.id) {
          const entry: ToolTraceEntry = { id: b.id, name: b.name ?? "tool", input: b.input, status: "done" };
          tools.push(entry);
          toolIndex.set(b.id, entry);
        }
      }
      out.push({ id: rid(), role: "assistant", text, tools });
    } else {
      for (const b of blocks) {
        if (b.type === "tool_result" && b.tool_use_id) {
          const entry = toolIndex.get(b.tool_use_id);
          if (entry) {
            entry.status = b.is_error ? "error" : "done";
            entry.summary = summarize(b.content);
          }
        }
      }
    }
  }
  return out;
}

export function useAgentSessions() {
  return useQuery({
    queryKey: ["agent-sessions"],
    queryFn: async (): Promise<AgentSessionSummary[]> => {
      const res = await fetch("/api/agent/sessions");
      if (!res.ok) throw new Error("Failed to load conversations");
      const data = await res.json();
      return data.sessions ?? [];
    },
  });
}

export interface LoadedSession {
  session: { id: string; title: string | null; locale: string; status: string };
  messages: UiMessage[];
}

/** Fetch one thread's transcript and transform it for hydration. */
export async function fetchAgentSession(id: string): Promise<LoadedSession> {
  const res = await fetch(`/api/agent/sessions/${id}`);
  if (!res.ok) throw new Error("Failed to load conversation");
  const data = await res.json();
  return { session: data.session, messages: storedToUiMessages(data.messages ?? []) };
}

export function useDeleteAgentSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/agent/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete conversation");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-sessions"] });
    },
  });
}
