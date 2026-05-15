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

  const responsePreview = text.length > 500
    ? `${text.slice(0, 250)}...[${text.length} chars total]...${text.slice(-250)}`
    : text;
  throw new Error(`Failed to parse AI JSON response (response length: ${text.length} chars, possibly truncated or malformed). Preview: ${responsePreview}`);
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

  // Thinking models (gemini-2.5-*) use thinking tokens that count toward maxOutputTokens.
  // Budget internal reasoning heavily + reserve output space for actual JSON.
  // Empirically, complex tasks need ~8x multiplier to avoid truncation.
  const effectiveMaxTokens = isThinkingModel
    ? Math.max(maxTokens * 8, 24576) // 8x budget for thinking + output
    : maxTokens;

  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: effectiveMaxTokens,
      temperature: isThinkingModel ? 0.7 : 0, // Lower temp for JSON consistency on non-thinking models
      ...(isThinkingModel ? {} : { responseMimeType: "application/json" }),
    },
  });

  const jsonPrompt = isThinkingModel
    ? `${userPrompt}\n\nIMPORTANT: Respond ONLY with a valid, complete JSON object. No markdown, no explanation outside JSON. Ensure all fields are present.`
    : userPrompt;

  // Try up to 4 times with exponential backoff (initial + 3 retries)
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      // Exponential backoff for retries: 0ms, 100ms, 300ms, 700ms
      if (attempt > 0) {
        const backoffMs = Math.pow(2, attempt) * 50 - 50;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }

      const result = await genModel.generateContent(jsonPrompt);
      const text = extractResponseText(result);
      console.log(`[AI JSON] ${model} attempt ${attempt + 1}: ${text.length} chars`);

      if (!text || text.trim() === "" || text.trim() === "{}") {
        throw new Error("AI returned empty response");
      }

      // Sanity check: truncated responses are usually < 1000 chars for enrichment tasks
      if (isThinkingModel && text.length < 500) {
        throw new Error(`Response too short (${text.length} chars) — likely truncated`);
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
      const shouldRetry =
        err instanceof SyntaxError ||
        msg.startsWith("Failed to parse") ||
        msg.includes("truncated") ||
        msg.includes("empty response") ||
        msg.includes("empty object") ||
        msg.includes("too short") ||
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
