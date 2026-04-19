export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { eq } from "drizzle-orm";
import {
  assertPermission,
  TeamPermissionError,
  teamErrorToStatus,
  type OrgRole,
} from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized, badRequest } from "@/lib/team/session";

const VALID_ROLES: OrgRole[] = ["admin", "member"];

/**
 * PATCH /api/team/members/[memberId]/role — Change a member's role.
 * Owner-only. Cannot change own role or the owner role.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const { memberId } = await params;
  const body = await req.json().catch(() => ({}));
  const newRole = (body as { role?: string }).role as OrgRole | undefined;

  if (!memberId) return badRequest("Member ID is required");
  if (!newRole || !VALID_ROLES.includes(newRole)) {
    return badRequest("Role must be 'admin' or 'member'");
  }

  // Find target member
  const targetMember = await db.query.member.findFirst({
    where: eq(member.id, memberId),
  });
  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const orgId = targetMember.organizationId;

  // Cannot change own role
  if (targetMember.userId === session.user.id) {
    return badRequest("Cannot change your own role");
  }

  // Cannot change owner's role (ownership must be transferred explicitly)
  if (targetMember.role === "owner") {
    return badRequest("Cannot change the owner's role. Use transfer ownership instead.");
  }

  // Only owner can change roles
  try {
    await assertPermission(session.user.id, orgId, "change_role");
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: teamErrorToStatus(err) });
    }
    throw err;
  }

  // No-op if role is already the same
  if (targetMember.role === newRole) {
    return NextResponse.json({ ok: true, role: newRole });
  }

  const previousRole = targetMember.role;

  await db
    .update(member)
    .set({ role: newRole })
    .where(eq(member.id, memberId));

  await logOrgEvent({
    organizationId: orgId,
    actorId: session.user.id,
    action: "role_changed",
    targetUserId: targetMember.userId,
    metadata: { previousRole, newRole },
  });

  return NextResponse.json({ ok: true, role: newRole });
}
