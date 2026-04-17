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

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}
