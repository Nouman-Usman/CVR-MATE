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
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validation/crm";
import { leaveOrgSchema } from "@/lib/validation/team";

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

  const rl = await checkRateLimit(session.user.id, "team_leave", 10, 3600);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  const parsed = parseBody(leaveOrgSchema, await req.json().catch(() => ({})));
  if (!parsed.ok) return badRequest(parsed.error);
  const { organizationId } = parsed.data;

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
