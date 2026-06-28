import "server-only";

import Anthropic from "@anthropic-ai/sdk";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  return new Anthropic({ apiKey });
}

export type AiModel = "claude-haiku-4-5-20251001" | "claude-sonnet-4-6-20250514";

interface GenerateOptions {
  model?: AiModel;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

export async function generateAiResponse(options: GenerateOptions): Promise<string> {
  const {
    model = "claude-haiku-4-5-20251001",
    systemPrompt,
    userPrompt,
    maxTokens = 1024,
  } = options;

  const client = getClient();

  try {
    const result = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = result.content[0]?.type === "text" ? result.content[0].text : "";
    return text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("429") || msg.includes("rate_limit") || msg.includes("overloaded")) {
      throw new Error("AI rate limit reached. Please wait a moment and try again.");
    }
    throw err;
  }
}

/**
 * Extract and parse JSON from a potentially messy AI response.
 * Handles: markdown fences, trailing commas, truncated output.
 */
function extractJson<T>(raw: string): T {
  let text = raw.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");

  // Try direct parse first
  try {
    const parsed = JSON.parse(text);
    // Reject empty objects/arrays — likely truncated or broken response
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length === 0 && !Array.isArray(parsed)) {
      throw new Error("Parsed to empty object — likely truncated");
    }
    return parsed as T;
  } catch {
    // Continue to repair attempts
  }

  // Find the outermost JSON object or array
  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");
  let start = -1;
  let open = "{";
  let close = "}";

  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) {
    start = objStart;
    open = "{";
    close = "}";
  } else if (arrStart >= 0) {
    start = arrStart;
    open = "[";
    close = "]";
  }

  if (start >= 0) {
    // Walk to find matching close bracket
    let depth = 0;
    let inString = false;
    let escape = false;
    let end = start;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === open) depth++;
      if (ch === close) {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    const candidate = text.slice(start, end + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
        return parsed as T;
      }
    } catch {
      // Try fixing truncated JSON by closing open braces/brackets
    }

    let fixed = candidate;
    // Remove trailing comma before we add closing brackets
    fixed = fixed.replace(/,\s*$/, "");

    // Recount open vs close braces/brackets
    let braces = 0;
    let brackets = 0;
    let inStr = false;
    let esc = false;
    for (const c of fixed) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;
      if (c === "{") braces++;
      if (c === "}") braces--;
      if (c === "[") brackets++;
      if (c === "]") brackets--;
    }

    // If we're inside a string, close it
    if (inStr) fixed += '"';
    // Close open brackets/braces
    while (brackets > 0) {
      fixed += "]";
      brackets--;
    }
    while (braces > 0) {
      fixed += "}";
      braces--;
    }

    try {
      const parsed = JSON.parse(fixed);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
        return parsed as T;
      }
    } catch {
      // Give up
    }
  }

  const responsePreview = text.length > 500
    ? `${text.slice(0, 250)}...[${text.length} chars total]...${text.slice(-250)}`
    : text;
  throw new Error(`Failed to parse AI JSON response (response length: ${text.length} chars, possibly truncated or malformed). Preview: ${responsePreview}`);
}

export async function generateAiJson<T>(options: GenerateOptions): Promise<T> {
  const {
    model = "claude-haiku-4-5-20251001",
    systemPrompt,
    userPrompt,
    maxTokens = 1024,
  } = options;

  const client = getClient();

  const jsonPrompt =
    `${userPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences, no explanation outside the JSON. Ensure all fields are present and complete.`;

  // Try up to 4 times with exponential backoff (initial + 3 retries)
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      // Exponential backoff for retries: 0ms, 100ms, 300ms, 700ms
      if (attempt > 0) {
        const backoffMs = Math.pow(2, attempt) * 50 - 50;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }

      const result = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: jsonPrompt }],
      });

      const text = result.content[0]?.type === "text" ? result.content[0].text : "";
      console.log(`[AI JSON] ${model} attempt ${attempt + 1}: ${text.length} chars`);

      if (!text || text.trim() === "" || text.trim() === "{}") {
        throw new Error("AI returned empty response");
      }

      return extractJson<T>(text);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : "";

      // Rate limit — throw user-friendly error immediately (no retry)
      if (msg.includes("429") || msg.includes("rate_limit") || msg.includes("overloaded")) {
        throw new Error("AI rate limit reached. Please wait a moment and try again.");
      }

      // Retry on parse failures, empty responses, and network errors
      const shouldRetry =
        err instanceof SyntaxError ||
        msg.startsWith("Failed to parse") ||
        msg.includes("truncated") ||
        msg.includes("empty response") ||
        msg.includes("empty object") ||
        msg.includes("fetch failed") ||
        msg.includes("ECONNRESET") ||
        msg.includes("timeout") ||
        msg.includes("network");

      if (shouldRetry && attempt < 3) {
        console.warn(`[AI] Attempt ${attempt + 1} failed: ${msg.slice(0, 100)}`);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}
