import "server-only";

import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * Extract the authenticated user from the request. Returns null if not
 * authenticated. All team routes must call this first.
 */
export async function getTeamSession(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return null;
  return session;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * 409 with an optional machine-readable body.
 *
 * The message is for a human; `details` lets a caller return the structured
 * facts behind the refusal (e.g. what an organization still owns) so the UI can
 * render them instead of parsing the sentence.
 */
export function conflict(message: string, details?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...details }, { status: 409 });
}
