import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const CHAT_LANDING_TRIAL_COOKIE = "chat_landing_origin";
const MAX_AGE_SECONDS = 60 * 60; // 1 hour

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not configured");
  return secret;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

/** Sets the signed chat-landing-origin cookie on a response, marking a session as trial-eligible. */
export function setTrialOriginCookie(res: NextResponse, sessionId: string) {
  const signature = sign(sessionId);
  res.cookies.set(CHAT_LANDING_TRIAL_COOKIE, `${sessionId}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

/** Reads and verifies the signed cookie; returns the sessionId if valid, null otherwise. Does not clear it. */
export function readTrialOriginCookie(req: NextRequest): string | null {
  const raw = req.cookies.get(CHAT_LANDING_TRIAL_COOKIE)?.value;
  if (!raw) return null;
  const dotIndex = raw.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const sessionId = raw.slice(0, dotIndex);
  const signature = raw.slice(dotIndex + 1);
  const expected = sign(sessionId);
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, signatureBuf)) return null;
  return sessionId;
}

/** Clears the cookie on a response. */
export function clearTrialOriginCookie(res: NextResponse) {
  res.cookies.delete(CHAT_LANDING_TRIAL_COOKIE);
}
