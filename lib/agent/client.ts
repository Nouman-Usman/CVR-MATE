import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic client for the agent runtime. Constructed the same way as
 * `lib/ai.ts` (single ANTHROPIC_API_KEY), but cached and used with streaming +
 * tools — capabilities the `lib/ai.ts` helpers do not expose.
 */
let cached: Anthropic | null = null;

export function getAgentClient(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  cached = new Anthropic({ apiKey });
  return cached;
}

/**
 * Current Sonnet tier — strong tool-use and reasoning at a fraction of Opus
 * cost. (Verified available on this account; the `claude-sonnet-4-6-*` id in
 * lib/ai.ts's type is stale and 404s.)
 */
export const AGENT_MODEL = "claude-sonnet-5" as const;

/** Max output tokens per assistant turn within the loop. */
export const AGENT_MAX_TOKENS = 2048;

/**
 * Hard cap on tool round-trips per user turn. Bounds cost and prevents a
 * runaway loop (the agent's DoS guard).
 */
export const MAX_TOOL_ITERATIONS = 8;
