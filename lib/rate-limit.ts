import "server-only";

import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = createRedisClient();

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Loud, once, at module load. Rate limiting is a security control, not a cache:
// running production without Redis is a misconfiguration, not a degraded mode.
// This logs rather than throwing because a throw here takes down every route in
// the deployment — a self-inflicted outage is worse than the thing it prevents.
// The actual protection is the fail-closed default below.
if (IS_PRODUCTION && !redis) {
  console.error(
    "[rate-limit] FATAL CONFIG: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set. " +
      "Rate-limited endpoints will REJECT all requests until Redis is configured."
  );
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Unix ms when the current window resets */
  resetAt: number;
}

/**
 * Fixed-window rate limiter backed by Upstash Redis.
 *
 * Key: `rl:{feature}:{userId}:{window_bucket}` — the first segment is any opaque
 * identity string, so IP-keyed limits pass e.g. `quote-ip:1.2.3.4`.
 *
 * **Failure posture depends on the environment.** In production, an unavailable
 * Redis fails CLOSED: previously it failed open everywhere, which meant a
 * deployment missing two env vars silently had *no* rate limiting at all on any
 * CRM mutation or on the public quote endpoints — the control looked present and
 * enforced nothing. In development it still fails open so nobody needs Redis
 * running to work on the app.
 *
 * `failClosed: true` forces closed in every environment; `failClosed: false`
 * forces open (use only where availability genuinely outranks the limit).
 */
export async function checkRateLimit(
  userId: string,
  feature: string,
  maxRequests: number,
  windowSeconds: number,
  options?: { failClosed?: boolean }
): Promise<RateLimitResult> {
  const failClosed = options?.failClosed ?? IS_PRODUCTION;

  if (!redis) {
    if (failClosed) {
      return { allowed: false, remaining: 0, resetAt: 0 };
    }
    return { allowed: true, remaining: maxRequests, resetAt: 0 };
  }

  const windowMs = windowSeconds * 1000;
  const bucket = Math.floor(Date.now() / windowMs);
  const key = `rl:${feature}:${userId}:${bucket}`;
  const resetAt = (bucket + 1) * windowMs;

  try {
    // INCR is atomic; pipeline to also set TTL in the same round-trip
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    // TTL = 2 windows so the key survives past the window boundary for late requests
    pipeline.expire(key, windowSeconds * 2);
    const results = await pipeline.exec();
    const count = results[0] as number;

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetAt,
    };
  } catch (err) {
    console.warn(
      `[rate-limit] Redis error, failing ${failClosed ? "closed" : "open"}:`,
      err
    );
    if (failClosed) {
      return { allowed: false, remaining: 0, resetAt };
    }
    return { allowed: true, remaining: maxRequests, resetAt };
  }
}

/** Standard 429 response for a rejected `checkRateLimit`. */
export function tooManyRequests(resetAt: number): NextResponse {
  const retryAfterSec = resetAt ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) : 60;
  return NextResponse.json(
    { error: "Too many requests. Please slow down.", retryAfter: retryAfterSec },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}
