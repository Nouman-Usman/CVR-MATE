/**
 * The single fetch wrapper for app API calls.
 *
 * Before this, ~40 hooks each re-implemented fetch → parse → `data.error ||
 * "Failed to …"`, every one of them throwing a bare `Error` whose message was
 * hardcoded English. That made two things impossible: telling a 409 apart from
 * a 500 at the call site, and translating an error for a Danish user.
 *
 * `ApiError` carries the status so callers can branch, and the raw payload so a
 * display layer can localize.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly payload: Record<string, unknown>;

  constructor(status: number, message: string, payload: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }

  /** A losing race on a document state transition (see CrmConflictError). */
  get isConflict(): boolean {
    return this.status === 409;
  }

  /** The org is on a plan that does not include this feature. */
  get isUpgradeRequired(): boolean {
    return this.status === 403 && this.payload.upgrade === true;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

async function readPayload(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    // An HTML error page or a proxy timeout — not JSON. Keep a trimmed excerpt
    // so the thrown error says something more useful than "Unexpected token <".
    return { error: text.slice(0, 200) };
  }
}

/**
 * Fetch and parse JSON, throwing `ApiError` on a non-2xx response.
 *
 * @throws ApiError
 */
export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const payload = await readPayload(res);

  if (!res.ok) {
    const message =
      typeof payload.error === "string" && payload.error
        ? payload.error
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, payload);
  }

  return payload as T;
}

/** POST/PATCH/DELETE helper — sets the JSON content type and serializes the body. */
export function jsonRequest(method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): RequestInit {
  return {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  };
}
