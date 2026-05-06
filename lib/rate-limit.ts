import "server-only";

import { Redis } from "@upstash/redis";

function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = createRedisClient();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Unix ms when the current window resets */
  resetAt: number;
}

/**
 * Fixed-window rate limiter backed by Upstash Redis.
 *
 * Key: `rl:{feature}:{userId}:{window_bucket}`
 * Window bucket = Math.floor(Date.now() / windowMs) — increments each period.
 *
 * Fails open when Redis is unavailable (no env vars configured).
 */
export async function checkRateLimit(
  userId: string,
  feature: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (!redis) {
    // Redis not configured — allow all requests (fail open)
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
    console.warn("[rate-limit] Redis error, failing open:", err);
    return { allowed: true, remaining: maxRequests, resetAt };
  }
}
