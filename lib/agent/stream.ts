import type { StreamEvent } from "./types";

/**
 * SSE framing for the agent turn endpoint. The turn endpoint is a POST (it
 * carries a request body), so the client cannot use EventSource; it reads the
 * response body via fetch + getReader() and splits on the blank-line delimiter.
 * We still use the `data: {json}\n\n` SSE wire format for familiarity and easy
 * parsing. Header set mirrors app/api/notifications/stream/route.ts.
 */

const encoder = new TextEncoder();

export function encodeEvent(event: StreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};
