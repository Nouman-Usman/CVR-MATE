import type { CrmProvider } from "./types";

export class CrmApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public provider: CrmProvider,
    public retryable: boolean
  ) {
    super(message);
    this.name = "CrmApiError";
  }
}

/** 401/403 — token expired or revoked */
export class CrmAuthError extends CrmApiError {
  constructor(message: string, provider: CrmProvider) {
    super(message, 401, provider, false);
    this.name = "CrmAuthError";
  }
}

/** 429 — rate limited by CRM provider */
export class CrmRateLimitError extends CrmApiError {
  constructor(
    message: string,
    provider: CrmProvider,
    public retryAfterMs?: number
  ) {
    super(message, 429, provider, true);
    this.name = "CrmRateLimitError";
  }
}

/** 404 — entity not found in CRM */
export class CrmNotFoundError extends CrmApiError {
  constructor(message: string, provider: CrmProvider) {
    super(message, 404, provider, false);
    this.name = "CrmNotFoundError";
  }
}

/** Classify a fetch response into the appropriate error type */
export async function classifyCrmError(
  res: Response,
  provider: CrmProvider,
  operation: string
): Promise<CrmApiError> {
  const body = await res.text().catch(() => "");
  const msg = `${provider} ${operation} failed (${res.status}): ${body}`;

  if (res.status === 401 || res.status === 403) {
    return new CrmAuthError(msg, provider);
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after");
    const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
    return new CrmRateLimitError(msg, provider, retryMs);
  }

  if (res.status === 404) {
    return new CrmNotFoundError(msg, provider);
  }

  // 5xx errors are retryable
  const retryable = res.status >= 500;
  return new CrmApiError(msg, res.status, provider, retryable);
}
