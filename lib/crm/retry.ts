import { CrmRateLimitError, CrmAuthError } from "./errors";

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

const DEFAULTS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
};

/**
 * Retry a CRM operation with exponential backoff.
 * - Retries on 429 (rate limit) and 5xx (server errors)
 * - Never retries on 401/403 (auth) or 404 (not found)
 * - Respects Retry-After header from rate limit errors
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions
): Promise<T> {
  const { maxRetries, baseDelayMs } = { ...DEFAULTS, ...opts };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Never retry auth errors
      if (err instanceof CrmAuthError) throw err;

      // Check if error is retryable
      const retryable =
        err instanceof CrmRateLimitError ||
        (err instanceof Error && "retryable" in err && (err as { retryable: boolean }).retryable);

      if (!retryable || attempt >= maxRetries) throw err;

      // Calculate delay: exponential backoff or rate-limit Retry-After
      let delayMs = baseDelayMs * Math.pow(2, attempt);
      if (err instanceof CrmRateLimitError && err.retryAfterMs) {
        delayMs = Math.max(delayMs, err.retryAfterMs);
      }

      // Cap at 30 seconds
      delayMs = Math.min(delayMs, 30_000);

      console.log(`[CRM Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
