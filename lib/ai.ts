import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenerativeAI(apiKey);
}

export type AiModel = "gemini-2.5-flash" | "gemini-2.5-pro" | "gemini-2.0-flash-lite";

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
      const parsed = JSON.parse(fixed);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
        return parsed as T;
      }
    } catch {
      // Give up
    }
  }

  throw new Error(`Failed to parse AI JSON response (possibly truncated): ${text.slice(0, 300)}`);
}

/**
 * Extract the actual text content from a Gemini response,
 * handling thinking models where .text() may return empty.
 */
function extractResponseText(result: { response: { text: () => string; candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] } }): string {
  // Try the standard .text() first
  const directText = result.response.text();
  if (directText && directText.trim() !== "" && directText.trim() !== "{}") {
    return directText;
  }

  // For thinking models (gemini-2.5-*), .text() can return empty.
  // Walk the response parts and collect non-thought text parts.
  const candidates = result.response.candidates;
  if (candidates?.[0]?.content?.parts) {
    const textParts: string[] = [];
    for (const part of candidates[0].content.parts) {
      // Skip thinking/thought parts — we only want the actual output
      if (part.thought) continue;
      if (part.text) textParts.push(part.text);
    }
    if (textParts.length > 0) {
      return textParts.join("");
    }

    // If ALL parts are thought parts, try collecting those as last resort
    for (const part of candidates[0].content.parts) {
      if (part.text) textParts.push(part.text);
    }
    if (textParts.length > 0) {
      return textParts.join("");
    }
  }

  return directText;
}

export async function generateAiJson<T>(options: GenerateOptions): Promise<T> {
  const {
    model = "gemini-2.5-flash",
    systemPrompt,
    userPrompt,
    maxTokens = 1024,
  } = options;

  const isThinkingModel = model.includes("2.5");
  const client = getClient();

  // Thinking models (gemini-2.5-*) use thinking tokens that count toward
  // maxOutputTokens. We need a much larger budget so the actual JSON output
  // isn't truncated. Also omit responseMimeType which breaks thinking models.
  const effectiveMaxTokens = isThinkingModel ? Math.max(maxTokens * 5, 16384) : maxTokens;

  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: effectiveMaxTokens,
      ...(isThinkingModel ? {} : { responseMimeType: "application/json" }),
    },
  });

  const jsonPrompt = isThinkingModel
    ? `${userPrompt}\n\nIMPORTANT: Respond ONLY with a valid JSON object. No markdown fences, no explanation outside the JSON.`
    : userPrompt;

  // Try up to 3 times (initial + 2 retries)
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await genModel.generateContent(jsonPrompt);
      const text = extractResponseText(result);
      console.log(`[AI JSON] ${model} attempt ${attempt + 1}: ${text.length} chars`);

      if (!text || text.trim() === "" || text.trim() === "{}") {
        throw new Error("AI returned empty response");
      }

      return extractJson<T>(text);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : "";

      // Rate limit — throw user-friendly error immediately (no retry)
      if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")) {
        throw new Error("AI rate limit reached. Please wait a moment and try again.");
      }

      // Retry on parse failures, empty responses, and network errors
      if (
        err instanceof SyntaxError ||
        msg.startsWith("Failed to parse") ||
        msg.includes("truncated") ||
        msg.includes("empty response") ||
        msg.includes("empty object") ||
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
