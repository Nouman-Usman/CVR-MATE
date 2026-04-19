export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invitation } from "@/db/auth-schema";
import { eq } from "drizzle-orm";
import {
  assertPermission,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized, badRequest } from "@/lib/team/session";

/**
 * DELETE /api/team/invitations/[invId] — Cancel a pending invitation.
 * Requires owner/admin.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ invId: string }> }
) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const { invId } = await params;
  if (!invId) return badRequest("Invitation ID is required");

  const inv = await db.query.invitation.findFirst({
    where: eq(invitation.id, invId),
  });
  if (!inv) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (inv.status !== "pending") {
    return badRequest("Invitation is no longer pending");
  }

  // RBAC
  try {
    await assertPermission(session.user.id, inv.organizationId, "cancel_invitation");
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: teamErrorToStatus(err) });
    }
    throw err;
  }

  // Mark as canceled (Better Auth uses status field)
  await db
    .update(invitation)
    .set({ status: "canceled" })
    .where(eq(invitation.id, invId));

  await logOrgEvent({
    organizationId: inv.organizationId,
    actorId: session.user.id,
    action: "invite_revoked",
    metadata: { email: inv.email, role: inv.role },
  });

  return NextResponse.json({ ok: true });
}
