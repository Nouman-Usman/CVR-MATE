export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { leadTrigger } from "@/db/app-schema";
import { eq, and } from "drizzle-orm";
import {
  assertUserIsMemberOfOrg,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized, badRequest } from "@/lib/team/session";

/**
 * POST /api/team/leave — Leave an organization.
 *
 * Owners cannot leave (must transfer ownership first).
 * On leave: the member's org-scoped triggers are deactivated and detached
 * to prevent orphaned cron jobs.
 */
export async function POST(req: NextRequest) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { organizationId } = body as { organizationId?: string };
  if (!organizationId) return badRequest("Organization ID is required");

  // Verify membership
  let membership;
  try {
    membership = await assertUserIsMemberOfOrg(session.user.id, organizationId);
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: teamErrorToStatus(err) });
    }
    throw err;
  }

  // Owners cannot leave — must transfer ownership first
  if (membership.role === "owner") {
    return badRequest("Owners cannot leave. Transfer ownership first.");
  }

  // Deactivate and detach this user's org-scoped triggers
  await db
    .update(leadTrigger)
    .set({ isActive: false, organizationId: null })
    .where(
      and(
        eq(leadTrigger.userId, session.user.id),
        eq(leadTrigger.organizationId, organizationId)
      )
    );

  // Remove membership
  await db.delete(member).where(eq(member.id, membership.id));

  await logOrgEvent({
    organizationId,
    actorId: session.user.id,
    action: "member_left",
    targetUserId: session.user.id,
    metadata: { role: membership.role },
  });

  return NextResponse.json({ ok: true });
}
