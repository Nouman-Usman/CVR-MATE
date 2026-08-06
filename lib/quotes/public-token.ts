import "server-only";

import { randomBytes, timingSafeEqual } from "crypto";

/**
 * Capability tokens for the public quote page.
 *
 * The token IS the authorization — anyone holding it can read the quote and
 * accept or reject it, with no account. That makes its entropy the whole
 * security boundary, so it is generated from a CSPRNG at 256 bits and is never
 * derived from the quote id, the number, or anything else an outsider could
 * guess or enumerate.
 */

/** 32 random bytes, base64url — 256 bits, URL-safe, no padding. */
export function generatePublicToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Shape check before the token ever reaches a query.
 *
 * Lookups are by unique index on an opaque string, so this is not an injection
 * guard — it is a cheap filter so obviously-bogus values (a scanner walking
 * short strings) never cost a database round trip.
 */
export function isWellFormedToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(value);
}

/**
 * Constant-time comparison, for any path that compares a token in application
 * code rather than in SQL. Length is not secret; content is.
 */
export function tokensMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
