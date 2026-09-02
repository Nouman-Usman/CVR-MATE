export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { eq } from "drizzle-orm";
import {
  assertPermission,
  assertCanActOnMember,
  TeamPermissionError,
  teamErrorToStatus,
  type OrgRole,
} from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { removeMemberFromOrg } from "@/lib/team/detach-member";
import { getTeamSession, unauthorized, badRequest } from "@/lib/team/session";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * DELETE /api/team/members/[memberId] — Remove a member from the org.
 * Requires owner/admin + role hierarchy (cannot remove equal or higher role).
 *
 * Removal used to delete the membership row and nothing else, which left the
 * removed person's lead triggers running and still delivering the org's results
 * to them. It now runs the same departure routine as `/leave`.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const { memberId } = await params;

  const rl = await checkRateLimit(session.user.id, "team_remove_member", 30, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);
  if (!memberId) return badRequest("Member ID is required");

  // Find the target member
  const targetMember = await db.query.member.findFirst({
    where: eq(member.id, memberId),
  });

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const orgId = targetMember.organizationId;

  // Cannot remove yourself via this route (use /api/team/leave instead)
  if (targetMember.userId === session.user.id) {
    return badRequest("Use /api/team/leave to leave an organization");
  }

  // RBAC: must have remove_member permission
  try {
    const actorMembership = await assertPermission(session.user.id, orgId, "remove_member");

    // Role hierarchy: cannot remove someone of equal or higher rank
    assertCanActOnMember(actorMembership.role, targetMember.role as OrgRole);
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      await logOrgEvent({
        organizationId: orgId,
        actorId: session.user.id,
        action: "permission_denied",
        metadata: { attemptedAction: "remove_member", targetMemberId: memberId },
      });
      return NextResponse.json({ error: err.message, code: err.code }, { status: teamErrorToStatus(err) });
    }
    throw err;
  }

  const detached = await removeMemberFromOrg(targetMember.userId, orgId, memberId);

  await logOrgEvent({
    organizationId: orgId,
    actorId: session.user.id,
    action: "member_removed",
    targetUserId: targetMember.userId,
    metadata: { role: targetMember.role, ...detached },
  });

  return NextResponse.json({ ok: true });
}
