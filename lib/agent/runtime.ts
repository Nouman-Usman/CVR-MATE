import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_MAX_TOKENS, AGENT_MODEL, getAgentClient, MAX_TOOL_ITERATIONS } from "./client";
import { buildAgentSystemPrompt } from "./system-prompt";
import { buildAnthropicTools, getToolByName } from "./tools";
import {
  appendMessage,
  getSessionRow,
  loadHistory,
  rebuildMessages,
  setInterrupt,
  touchSession,
} from "./persistence";
import { isAgentQuotaError } from "./errors";
import type {
  AgentContext,
  AgentTool,
  EmitFn,
  PendingInterrupt,
  ToolResultLite,
  ToolUseLite,
} from "./types";

const MAX_RESULT_CHARS = 24_000;

function serialize(data: unknown): string {
  const s = JSON.stringify(data ?? null);
  return s.length > MAX_RESULT_CHARS ? `${s.slice(0, MAX_RESULT_CHARS)}…[truncated]` : s;
}

function toResultBlocks(results: ToolResultLite[]): Anthropic.ContentBlockParam[] {
  return results.map((r) => ({
    type: "tool_result" as const,
    tool_use_id: r.toolUseId,
    content: r.content,
    is_error: r.isError,
  }));
}

interface InvokeOutcome {
  content: string;
  isError: boolean;
  summary?: string;
  display?: unknown;
}

/** Validate the model's tool input against the Zod schema, then execute. */
async function invokeTool(tool: AgentTool, tu: ToolUseLite, ctx: AgentContext): Promise<InvokeOutcome> {
  let parsed: unknown;
  try {
    parsed = tool.schema.parse(tu.input);
  } catch (e) {
    return {
      content: serialize({ error: "Invalid tool input", details: e instanceof Error ? e.message : String(e) }),
      isError: true,
    };
  }
  try {
    const res = await tool.execute(parsed, ctx);
    return { content: serialize(res.data), isError: !!res.isError, summary: res.summary, display: res.display };
  } catch (e) {
    if (isAgentQuotaError(e)) throw e; // propagate: stops the loop, surfaces upgrade
    return { content: serialize({ error: e instanceof Error ? e.message : "Tool failed" }), isError: true };
  }
}

type BatchOutcome =
  | { status: "complete"; results: ToolResultLite[] }
  | { status: "paused"; results: ToolResultLite[]; awaitingIndex: number };

/**
 * Run the tools in an assistant turn's batch, in order, starting at `startIndex`.
 * Read tools execute immediately; the first write tool pauses the batch (returns
 * `paused`) so the caller can ask the user to confirm it.
 */
async function processToolBatch(
  toolUses: ToolUseLite[],
  prior: ToolResultLite[],
  startIndex: number,
  ctx: AgentContext,
  emit: EmitFn
): Promise<BatchOutcome> {
  const results = [...prior];
  for (let i = startIndex; i < toolUses.length; i++) {
    const tu = toolUses[i];
    const tool = getToolByName(tu.name);
    if (!tool) {
      results.push({ toolUseId: tu.id, content: serialize({ error: `Unknown tool: ${tu.name}` }), isError: true });
      continue;
    }
    if (tool.kind === "write") {
      return { status: "paused", results, awaitingIndex: i };
    }
    emit({ type: "tool_call", id: tu.id, name: tu.name, input: tu.input });
    const out = await invokeTool(tool, tu, ctx);
    emit({ type: "tool_result", id: tu.id, name: tu.name, summary: out.summary, display: out.display, isError: out.isError });
    results.push({ toolUseId: tu.id, content: out.content, isError: out.isError });
  }
  return { status: "complete", results };
}

/** Persist the pending batch, flip the session to awaiting_confirmation, emit interrupt. */
async function pauseForConfirm(
  sessionId: string,
  toolUses: ToolUseLite[],
  results: ToolResultLite[],
  awaitingIndex: number,
  emit: EmitFn
): Promise<void> {
  const awaiting = toolUses[awaitingIndex];
  const tool = getToolByName(awaiting.name);
  const pending: PendingInterrupt = { toolUses, results, awaitingIndex };
  await setInterrupt(sessionId, pending, "awaiting_confirmation");

  let humanSummary = `Run ${awaiting.name}`;
  if (tool?.confirmSummary) {
    try {
      humanSummary = tool.confirmSummary(tool.schema.parse(awaiting.input));
    } catch {
      /* fall back to the generic summary */
    }
  }
  emit({ type: "interrupt", toolUseId: awaiting.id, name: awaiting.name, input: awaiting.input, humanSummary });
}

/** Stream one assistant turn: emit text deltas live, persist the message, return its tool calls. */
async function streamAssistantTurn(
  sessionId: string,
  ctx: AgentContext,
  emit: EmitFn,
  opts: { disableTools?: boolean } = {}
): Promise<{ stopReason: Anthropic.StopReason | null; toolUses: ToolUseLite[] }> {
  const messages = rebuildMessages(await loadHistory(sessionId));
  const client = getAgentClient();

  const stream = client.messages.stream({
    model: AGENT_MODEL,
    max_tokens: AGENT_MAX_TOKENS,
    system: buildAgentSystemPrompt(ctx.locale, ctx.brandContext),
    messages,
    ...(opts.disableTools ? {} : { tools: buildAnthropicTools() }),
  });

  for await (const ev of stream) {
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
      emit({ type: "text", delta: ev.delta.text });
    }
  }

  const final = await stream.finalMessage();
  await appendMessage(sessionId, "assistant", final.content as unknown as Anthropic.ContentBlockParam[]);

  const toolUses: ToolUseLite[] = final.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));

  return { stopReason: final.stop_reason, toolUses };
}

/**
 * The ReAct loop: stream an assistant turn, run its tools, feed results back,
 * repeat — until the model answers without tools, a write pauses for
 * confirmation, or the iteration cap is hit.
 */
async function runLoop(sessionId: string, ctx: AgentContext, emit: EmitFn, startIteration = 0): Promise<void> {
  for (let iter = startIteration; iter < MAX_TOOL_ITERATIONS; iter++) {
    const { stopReason, toolUses } = await streamAssistantTurn(sessionId, ctx, emit);

    if (stopReason !== "tool_use" || toolUses.length === 0) {
      emit({ type: "message_done" });
      emit({ type: "done" });
      return;
    }

    const batch = await processToolBatch(toolUses, [], 0, ctx, emit);
    if (batch.status === "paused") {
      await pauseForConfirm(sessionId, toolUses, batch.results, batch.awaitingIndex, emit);
      return;
    }
    await appendMessage(sessionId, "tool_result", toResultBlocks(batch.results));
  }

  // Iteration cap reached — force a final answer with tools disabled.
  await streamAssistantTurn(sessionId, ctx, emit, { disableTools: true });
  emit({ type: "message_done" });
  emit({ type: "done" });
}

function handleTerminalError(e: unknown, emit: EmitFn): void {
  if (isAgentQuotaError(e)) {
    emit({ type: "error", message: e.message, upgrade: true });
    return;
  }
  console.error("[agent] turn failed:", e instanceof Error ? e.message : e);
  emit({ type: "error", message: e instanceof Error ? e.message : "The agent hit an unexpected error." });
}

// ─── Public entry points ────────────────────────────────────────────────────

/** Run a fresh user turn: persist the message, then drive the loop. */
export async function runAgentTurn(params: {
  sessionId: string;
  userMessage: string;
  ctx: AgentContext;
  emit: EmitFn;
}): Promise<void> {
  const { sessionId, userMessage, ctx, emit } = params;
  try {
    await appendMessage(sessionId, "user", [{ type: "text", text: userMessage }]);
    await runLoop(sessionId, ctx, emit, 0);
  } catch (e) {
    handleTerminalError(e, emit);
  } finally {
    await touchSession(sessionId);
  }
}

/**
 * Resume a paused turn after the user approves or rejects the pending write.
 * Executes (or declines) the awaiting tool, finishes the batch, then continues
 * the loop.
 */
export async function resumeAfterConfirm(params: {
  sessionId: string;
  ctx: AgentContext;
  emit: EmitFn;
  toolUseId: string;
  approved: boolean;
}): Promise<void> {
  const { sessionId, ctx, emit, toolUseId, approved } = params;
  try {
    const session = await getSessionRow(sessionId);
    const pending = session?.pendingInterrupt ?? null;
    if (!pending) {
      emit({ type: "error", message: "No action is awaiting confirmation." });
      return;
    }
    const awaiting = pending.toolUses[pending.awaitingIndex];
    if (!awaiting || awaiting.id !== toolUseId) {
      emit({ type: "error", message: "Confirmation did not match the pending action." });
      return;
    }

    let result: ToolResultLite;
    if (!approved) {
      emit({ type: "tool_result", id: awaiting.id, name: awaiting.name, summary: "declined" });
      result = {
        toolUseId: awaiting.id,
        content: serialize({ declined: true, message: "The user declined this action. Do not retry it; offer an alternative." }),
        isError: false,
      };
    } else {
      const tool = getToolByName(awaiting.name);
      if (!tool) {
        result = { toolUseId: awaiting.id, content: serialize({ error: `Unknown tool: ${awaiting.name}` }), isError: true };
      } else {
        emit({ type: "tool_call", id: awaiting.id, name: awaiting.name, input: awaiting.input });
        const out = await invokeTool(tool, awaiting, ctx);
        emit({ type: "tool_result", id: awaiting.id, name: awaiting.name, summary: out.summary, display: out.display, isError: out.isError });
        result = { toolUseId: awaiting.id, content: out.content, isError: out.isError };
      }
    }

    const results = [...pending.results, result];
    const batch = await processToolBatch(pending.toolUses, results, pending.awaitingIndex + 1, ctx, emit);
    if (batch.status === "paused") {
      await pauseForConfirm(sessionId, pending.toolUses, batch.results, batch.awaitingIndex, emit);
      return;
    }

    await setInterrupt(sessionId, null, "active");
    await appendMessage(sessionId, "tool_result", toResultBlocks(batch.results));
    await runLoop(sessionId, ctx, emit, 0);
  } catch (e) {
    handleTerminalError(e, emit);
  } finally {
    await touchSession(sessionId);
  }
}
