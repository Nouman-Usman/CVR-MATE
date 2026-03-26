import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenerativeAI(apiKey);
}

export type AiModel = "gemini-2.5-flash" | "gemini-2.5-flash" | "gemini-2.5-pro";

interface GenerateOptions {
  model?: AiModel;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

export async function generateAiResponse(options: GenerateOptions): Promise<string> {
  const {
    model = "gemini-2.5-flash",
    systemPrompt,
    userPrompt,
    maxTokens = 1024,
  } = options;

  const client = getClient();
  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
    },
  });

  try {
    const result = await genModel.generateContent(userPrompt);
    const text = result.response.text();
    return text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")) {
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
    return JSON.parse(text) as T;
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
      return JSON.parse(candidate) as T;
    } catch {
      // Try fixing truncated JSON by closing open braces/brackets
      let fixed = candidate;
      // Remove trailing comma before we add closing brackets
      fixed = fixed.replace(/,\s*$/, "");

      // Recount open vs close braces/brackets
      let braces = 0;
      let brackets = 0;
      let inStr = false;
      let esc = false;
      for (const c of fixed) {
        if (esc) { esc = false; continue; }
        if (c === "\\") { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === "{") braces++;
        if (c === "}") braces--;
        if (c === "[") brackets++;
        if (c === "]") brackets--;
      }

      // If we're inside a string, close it
      if (inStr) fixed += '"';
      // Close open brackets/braces
      while (brackets > 0) { fixed += "]"; brackets--; }
      while (braces > 0) { fixed += "}"; braces--; }

      try {
        return JSON.parse(fixed) as T;
      } catch {
        // Give up
      }
    }
  }

  throw new Error(`Failed to parse AI JSON response: ${text.slice(0, 200)}`);
}

export async function generateAiJson<T>(options: GenerateOptions): Promise<T> {
  const {
    model = "gemini-2.5-flash",
    systemPrompt,
    userPrompt,
    maxTokens = 1024,
  } = options;

  const client = getClient();
  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
    },
  });

  // Try up to 3 times (initial + 2 retries)
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await genModel.generateContent(userPrompt);
      const text = result.response.text();
      return extractJson<T>(text);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : "";

      // Rate limit — throw user-friendly error immediately (no retry)
      if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")) {
        throw new Error("AI rate limit reached. Please wait a moment and try again.");
      }

      // Retry on parse failures and network/fetch errors
      if (
        err instanceof SyntaxError ||
        msg.startsWith("Failed to parse") ||
        msg.includes("fetch failed") ||
        msg.includes("ECONNRESET") ||
        msg.includes("timeout") ||
        msg.includes("network")
      ) {
        console.warn(`[AI] Attempt ${attempt + 1} failed (${msg.slice(0, 80)}), retrying...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
