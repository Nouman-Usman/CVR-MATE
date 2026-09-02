import { createHmac, timingSafeEqual } from "crypto";

/**
 * The state carried across the e-conomic grant redirect.
 *
 * e-conomic's flow is not OAuth 2.0. There is no `state` parameter that a
 * provider echoes back — the app sends the user to a request-access page, and
 * e-conomic redirects to a fixed callback URL with the agreement grant token
 * appended. So the anti-forgery value cannot round-trip through the provider
 * the way it does for HubSpot or Pipedrive.
 *
 * It travels in an HttpOnly cookie instead, and is SIGNED rather than opaque.
 * A random opaque value would only prove "this browser started a flow"; signing
 * lets the callback also prove *which organization* and *which user* started it,
 * without a server-side store, and detect any tampering with either.
 *
 * The callback still re-checks the live session and re-asserts permission — the
 * cookie says what was intended, never what is allowed.
 *
 * Pure and dependency-free so the encoding can be tested without a request.
 */

export interface GrantState {
  organizationId: string;
  userId: string;
  /** Unix seconds. Short by design — a connect flow takes a minute, not a day. */
  exp: number;
}

export const GRANT_STATE_COOKIE = "economic_grant_state";
/** Ten minutes: long enough to log in to e-conomic, short enough to bound abuse. */
export const GRANT_STATE_TTL_SECONDS = 600;

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(payload: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(payload).digest());
}

/** `<base64url(json)>.<base64url(hmac)>` */
export function signGrantState(state: GrantState, secret: string): string {
  const payload = b64url(JSON.stringify(state));
  return `${payload}.${sign(payload, secret)}`;
}

export type VerifyResult =
  | { ok: true; state: GrantState }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

/**
 * Verify and decode. Returns a reason rather than throwing, because every
 * failure here ends in the same place — a redirect back to Settings with an
 * error code — and the caller should not have to distinguish by exception type.
 */
export function verifyGrantState(
  token: string | undefined,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): VerifyResult {
  if (!token) return { ok: false, reason: "malformed" };

  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: "malformed" };

  const payload = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = sign(payload, secret);

  // Constant-time: a length-varying or short-circuiting compare on a MAC leaks
  // enough to forge one given enough attempts.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromB64url(payload).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as GrantState).organizationId !== "string" ||
    typeof (parsed as GrantState).userId !== "string" ||
    typeof (parsed as GrantState).exp !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  const state = parsed as GrantState;
  if (state.exp <= nowSeconds) return { ok: false, reason: "expired" };

  return { ok: true, state };
}
