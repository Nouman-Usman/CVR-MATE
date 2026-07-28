import type { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

/** Language the agent converses in (matches the app's i18n locales). */
export type AgentLocale = "da" | "en";

/**
 * Per-request context threaded into every tool execution. Built once per turn
 * from the authenticated session (see the /api/agent/search route) and passed
 * unchanged to each tool's `execute`.
 */
export interface AgentContext {
  userId: string;
  /** Active org id for team-scoped rows; null for personal scope. */
  organizationId: string | null;
  locale: AgentLocale;
  /** Formatted brand voice/personalization ("" when the user has no brand). */
  brandContext: string;
}

/**
 * Result of running a tool.
 * `data` becomes the tool_result content handed back to the model.
 * `display` is surfaced directly to the client (e.g. company cards) and is not
 * necessarily what the model sees.
 */
export interface AgentToolResult {
  data: unknown;
  /** Short label for the UI tool-trace, e.g. "42 companies". */
  summary?: string;
  /** Rich payload streamed to the client for rendering. */
  display?: unknown;
  /** True when the tool failed but the loop should continue (error → model). */
  isError?: boolean;
}

/**
 * A tool the agent can call. Authored once as a Zod schema; the schema is
 * converted to Anthropic's `input_schema` (JSON Schema) for the model and
 * reused to validate the model's tool input before `execute` runs.
 *
 * `kind: "read"` tools run automatically inside the loop. `kind: "write"` tools
 * pause the loop for explicit user confirmation (the human-in-the-loop
 * interrupt) before executing.
 */
export interface AgentTool<I = unknown> {
  name: string;
  description: string;
  kind: "read" | "write";
  schema: z.ZodType<I>;
  execute: (input: I, ctx: AgentContext) => Promise<AgentToolResult>;
  /** Human-readable confirmation prompt for write tools (shown in the ConfirmCard). */
  confirmSummary?: (input: I) => string;
}

// ─── Streamed events (each becomes one SSE `data:` frame) ───────────────────

export type StreamEvent =
  | { type: "session"; sessionId: string }
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | {
      type: "tool_result";
      id: string;
      name: string;
      summary?: string;
      display?: unknown;
      isError?: boolean;
    }
  | {
      type: "interrupt";
      toolUseId: string;
      name: string;
      input: unknown;
      humanSummary: string;
    }
  | { type: "message_done" }
  | { type: "error"; message: string; upgrade?: boolean }
  | { type: "done" };

/** Callback the runtime uses to push events to the client stream. */
export type EmitFn = (event: StreamEvent) => void;

// ─── Persistence shapes (mirror the agent_message / agent_session rows) ──────

export type StoredRole = "user" | "assistant" | "tool_result";

/**
 * One persisted transcript row. `content` holds Anthropic content blocks
 * verbatim so history rebuilds losslessly for the next messages.stream() call.
 * A `tool_result` row rebuilds into a **user**-role message (Anthropic requires
 * tool_result blocks to live in a user turn).
 */
export interface StoredMessage {
  role: StoredRole;
  content: Anthropic.ContentBlockParam[];
}

/** A single tool_use the model requested (id + name + validated-or-raw input). */
export interface ToolUseLite {
  id: string;
  name: string;
  input: unknown;
}

/** A computed tool result, aligned to its tool_use by id. */
export interface ToolResultLite {
  toolUseId: string;
  content: string;
  isError: boolean;
}

/**
 * Persisted on agent_session.pending_interrupt while a write-action awaits
 * confirmation. Holds the full assistant tool batch, the results already
 * computed for the tools before the pending write, and the index of the
 * tool_use awaiting the user's decision — enough to resume mid-batch.
 */
export interface PendingInterrupt {
  toolUses: ToolUseLite[];
  results: ToolResultLite[];
  awaitingIndex: number;
}
