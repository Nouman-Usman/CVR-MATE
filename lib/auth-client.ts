"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.replace(/\/$/, "") || "http://localhost:3000",
  fetchOptions: {
    onSuccess: (ctx) => {
      // Cache session data on successful auth responses
      if (ctx.response?.ok && ctx.data) {
        try {
          sessionStorage.setItem(
            "cvr-mate-session-cache",
            JSON.stringify({
              data: ctx.data,
              cachedAt: Date.now(),
            })
          );
        } catch {}
      }
    },
  },
});

export const { useSession, signIn, signUp, signOut: _signOut } = authClient;

// Wrap signOut to clear cache
export async function signOut() {
  try {
    sessionStorage.removeItem("cvr-mate-session-cache");
  } catch {}
  return _signOut();
}

// Get cached session for instant hydration (avoids loading flash)
export function getCachedSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("cvr-mate-session-cache");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire cache after 5 minutes — real session check happens via useSession
    if (Date.now() - parsed.cachedAt > 5 * 60 * 1000) {
      sessionStorage.removeItem("cvr-mate-session-cache");
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
