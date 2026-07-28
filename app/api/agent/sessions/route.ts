import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { validateActiveOrg } from "@/lib/team/permissions";
import { createSession, listSessions } from "@/lib/agent/persistence";
import type { AgentLocale } from "@/lib/agent/types";

/** List the caller's agent threads (personal + active-org scoped), newest first. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const organizationId = await validateActiveOrg(userId, session.session?.activeOrganizationId);
  const sessions = await listSessions(userId, organizationId);
  return NextResponse.json({ sessions });
}

/** Create an empty thread (the first turn can also create one implicitly). */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const organizationId = await validateActiveOrg(userId, session.session?.activeOrganizationId);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = (raw ?? {}) as Record<string, unknown>;
  const locale: AgentLocale = body.locale === "en" ? "en" : "da";

  const sessionId = await createSession({ userId, organizationId, locale });
  return NextResponse.json({ sessionId }, { status: 201 });
}
