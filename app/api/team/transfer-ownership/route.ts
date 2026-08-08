export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { eq, and } from "drizzle-orm";
import {
  assertPermission,
  userPlanHasTeamFeatures,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized, badRequest } from "@/lib/team/session";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validation/crm";
import { transferOwnershipSchema } from "@/lib/validation/team";

/**
 * POST /api/team/transfer-ownership — Transfer ownership to another member.
 *
 * Owner-only. The new owner must be an existing member.
 * After transfer: old owner becomes admin, new owner becomes owner.
 */
export async function POST(req: NextRequest) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  // Irreversible without the new owner's cooperation, so it is throttled hard.
  const rl = await checkRateLimit(session.user.id, "team_transfer_ownership", 5, 3600);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  const parsed = parseBody(transferOwnershipSchema, await req.json().catch(() => ({})));
  if (!parsed.ok) return badRequest(parsed.error);
  const { organizationId, newOwnerId } = parsed.data;

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

  /**
   * The incoming owner must be able to carry the plan.
   *
   * An organization's entitlement is read from whoever holds `owner`, so
   * transferring to someone on Free does not merely relabel a row — it revokes
   * team features for every member at once, while the previous owner keeps
   * paying for an organization they no longer control. Refusing is recoverable;
   * a silently disabled org is not.
   */
  if (!(await userPlanHasTeamFeatures(newOwnerId))) {
    return NextResponse.json(
      {
        error:
          "That member does not have an Enterprise subscription. The organization's plan follows its owner, so transferring would disable team features for everyone.",
        code: "PLAN_NOT_ALLOWED",
      },
      { status: 409 }
    );
  }

  /**
   * Demote first, then promote, both guarded on the roles we read.
   *
   * The previous version issued two unconditional updates. Two concurrent
   * transfers each saw the same current owner, and the second one re-demoted an
   * already-demoted row and promoted a second person — leaving two owners, at
   * which point which subscription governed the org depended on which row
   * Postgres returned first. Zero rows from the demote means someone else
   * transferred in between.
   *
   * The order matters as well: `member_single_owner_uq` would reject a promote
   * that ran before the demote.
   */
  const transferred = await db.transaction(async (tx) => {
    const demoted = await tx
      .update(member)
      .set({ role: "admin" })
      .where(and(eq(member.id, ownerMember.id), eq(member.role, "owner")))
      .returning({ id: member.id });
    if (demoted.length === 0) return false;

    await tx
      .update(member)
      .set({ role: "owner" })
      .where(eq(member.id, targetMember.id));
    return true;
  });

  if (!transferred) {
    return NextResponse.json(
      { error: "Ownership changed while transferring — reload and try again." },
      { status: 409 }
    );
  }

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
