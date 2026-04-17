export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { eq, and } from "drizzle-orm";
import {
  assertPermission,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized, badRequest } from "@/lib/team/session";

/**
 * POST /api/team/transfer-ownership — Transfer ownership to another member.
 *
 * Owner-only. The new owner must be an existing member.
 * After transfer: old owner becomes admin, new owner becomes owner.
 */
export async function POST(req: NextRequest) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { organizationId, newOwnerId } = body as {
    organizationId?: string;
    newOwnerId?: string;
  };

  if (!organizationId) return badRequest("Organization ID is required");
  if (!newOwnerId) return badRequest("New owner ID is required");

  // Cannot transfer to self
  if (newOwnerId === session.user.id) {
    return badRequest("Cannot transfer ownership to yourself");
  }

  // Must be the owner
  try {
    await assertPermission(session.user.id, organizationId, "transfer_ownership");
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: teamErrorToStatus(err) });
    }
    throw err;
  }

  // Verify the target is an existing member
  const targetMember = await db.query.member.findFirst({
    where: and(
      eq(member.userId, newOwnerId),
      eq(member.organizationId, organizationId)
    ),
  });
  if (!targetMember) {
    return badRequest("Target user is not a member of this organization");
  }

  // Find the current owner's membership record
  const ownerMember = await db.query.member.findFirst({
    where: and(
      eq(member.userId, session.user.id),
      eq(member.organizationId, organizationId)
    ),
  });
  if (!ownerMember) {
    return badRequest("Owner membership record not found");
  }

  // Atomic swap: old owner → admin, new owner → owner
  await db.transaction(async (tx) => {
    await tx
      .update(member)
      .set({ role: "admin" })
      .where(eq(member.id, ownerMember.id));

    await tx
      .update(member)
      .set({ role: "owner" })
      .where(eq(member.id, targetMember.id));
  });

  await logOrgEvent({
    organizationId,
    actorId: session.user.id,
    action: "ownership_transferred",
    targetUserId: newOwnerId,
    metadata: {
      previousOwnerRole: "admin",
      newOwnerPreviousRole: targetMember.role,
    },
  });

  return NextResponse.json({ ok: true });
}
