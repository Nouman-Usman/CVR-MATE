import "server-only";

import { createHash } from "crypto";
import { db } from "@/db";
import { apiKey } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { cacheGet, cacheSet } from "@/lib/redis";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ApiKeyContext {
  apiKeyId: string;
  organizationId: string;
  scopes: string[];
  createdByUserId: string;
}

export class ApiKeyError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.name = "ApiKeyError";
    this.status = status;
  }
}

// ─── Key generation ─────────────────────────────────────────────────────────

const KEY_PREFIX = "cvrm_";

/**
 * Generate a new API key. Returns the plaintext key (shown once) and the hash (stored).
 */
export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const plaintext = `${KEY_PREFIX}${raw}`;
  const hash = hashApiKey(plaintext);
  const prefix = plaintext.slice(0, 12); // "cvrm_" + 7 chars
  return { plaintext, hash, prefix };
}

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// ─── Rate limiting ──────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds

async function checkRateLimit(
  keyId: string,
  limit: number
): Promise<{ allowed: boolean; remaining: number }> {
  const cacheKey = `api_rate:${keyId}`;

  const current = await cacheGet<number>(cacheKey);
  const count = current ?? 0;

  if (count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  // Increment (set with TTL if new)
  await cacheSet(cacheKey, count + 1, RATE_LIMIT_WINDOW);
  return { allowed: true, remaining: limit - count - 1 };
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate an API key from the Authorization header.
 * Returns the org context if valid, throws ApiKeyError if not.
 *
 * Usage in API routes:
 *   const authHeader = request.headers.get("authorization");
 *   const ctx = await validateApiKey(authHeader);
 */
export async function validateApiKey(
  authorizationHeader: string | null
): Promise<ApiKeyContext> {
  if (!authorizationHeader) {
    throw new ApiKeyError("Missing Authorization header");
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token?.startsWith(KEY_PREFIX)) {
    throw new ApiKeyError("Invalid API key format. Expected: Bearer cvrm_...");
  }

  const hash = hashApiKey(token);

  // Look up the key
  const key = await db.query.apiKey.findFirst({
    where: and(eq(apiKey.keyHash, hash), eq(apiKey.isActive, true)),
  });

  if (!key) {
    throw new ApiKeyError("Invalid or revoked API key");
  }

  // Check expiration
  if (key.expiresAt && key.expiresAt < new Date()) {
    throw new ApiKeyError("API key has expired", 401);
  }

  // Check rate limit
  const { allowed, remaining } = await checkRateLimit(key.id, key.rateLimit);
  if (!allowed) {
    throw new ApiKeyError(
      `Rate limit exceeded. Limit: ${key.rateLimit}/hour`,
      429
    );
  }

  // Update lastUsedAt (fire and forget)
  db.update(apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKey.id, key.id))
    .catch(() => {});

  return {
    apiKeyId: key.id,
    organizationId: key.organizationId,
    scopes: key.scopes as string[],
    createdByUserId: key.createdByUserId,
  };
}

/**
 * Check if the API key has a required scope.
 */
export function requireScope(ctx: ApiKeyContext, scope: string): void {
  if (!ctx.scopes.includes(scope) && !ctx.scopes.includes("admin")) {
    throw new ApiKeyError(`Insufficient scope. Required: ${scope}`, 403);
  }
}

/**
 * Helper to convert ApiKeyError to a Response.
 */
export function handleApiKeyError(error: unknown): Response {
  if (error instanceof ApiKeyError) {
    return Response.json(
      { error: error.message },
      { status: error.status }
    );
  }
  throw error;
}
