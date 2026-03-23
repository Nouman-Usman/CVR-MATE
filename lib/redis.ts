import "server-only";

import { Redis } from "@upstash/redis";

// Create Redis client only if env vars are available
function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = createRedisClient();

const KEY_PREFIX = "cvr:";

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const data = await redis.get<T>(`${KEY_PREFIX}${key}`);
    return data ?? null;
  } catch (e) {
    console.warn("Redis GET error:", e);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`${KEY_PREFIX}${key}`, value, { ex: ttlSeconds });
  } catch (e) {
    console.warn("Redis SET error:", e);
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`${KEY_PREFIX}${key}`);
  } catch (e) {
    console.warn("Redis DEL error:", e);
  }
}

export function isRedisAvailable(): boolean {
  return redis !== null;
}
