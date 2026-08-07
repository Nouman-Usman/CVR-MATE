export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { invitation, member } from "@/db/auth-schema";
import { orgAuditLog } from "@/db/app-schema";
import { assertOrgPlanActive, TeamPermissionError } from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized } from "@/lib/team/session";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * POST /api/team/invitations/[invId]/accepted
 *
 * Records that an invitation was accepted. Better Auth performs the acceptance
 * itself (`authClient.organization.acceptInvitation`); this writes the audit
 * entry and enforces the two things Better Auth cannot know about.
 *
 * It used to write that entry after checking only that the invitation existed —
 * not that it had been accepted, and not that the caller was the invitee. Any
 * authenticated user holding an invite link, including someone who had just
 * declined it, could POST it repeatedly and forge acceptance records into
 * another organization's audit log. For a table the retention policy calls a
 * "compliance audit trail", accepting unverified writes defeats the purpose.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invId: string }> }
) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const { invId } = await params;

  const rl = await checkRateLimit(session.user.id, "invite_accepted", 30, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  const inv = await db.query.invitation.findFirst({ where: eq(invitation.id, invId) });
  // Unknown id: say nothing useful, and write nothing.
  if (!inv) return NextResponse.json({ ok: true });

  // The caller must be the person who was invited.
  if (session.user.email?.toLowerCase() !== inv.email.toLowerCase()) {
    return NextResponse.json({ error: "Not your invitation" }, { status: 403 });
  }

  /**
   * Membership — not `invitation.status` — is the proof that acceptance
   * happened. Better Auth owns the acceptance and its own status vocabulary;
   * the member row is the observable result, so checking it keeps this correct
   * regardless of how the library records state internally.
   */
  const membership = await db.query.member.findFirst({
    where: and(eq(member.userId, session.user.id), eq(member.organizationId, inv.organizationId)),
  });
  if (!membership) {
    return NextResponse.json({ error: "Invitation has not been accepted" }, { status: 409 });
  }

  /**
   * Plan is checked when the invitation is sent, but acceptance can be days
   * later and Better Auth knows nothing about billing. If the organization no
   * longer qualifies, undo the membership rather than leaving someone holding a
   * seat in an org that cannot have teams.
   */
  try {
    await assertOrgPlanActive(inv.organizationId);
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      await db.delete(member).where(eq(member.id, membership.id));
      await db
        .update(invitation)
        .set({ status: "canceled" })
        .where(and(eq(invitation.id, inv.id), eq(invitation.status, "accepted")));
      await logOrgEvent({
        organizationId: inv.organizationId,
        actorId: session.user.id,
        action: "permission_denied",
        targetUserId: session.user.id,
        metadata: { attemptedAction: "accept_invitation", reason: err.code, invitationId: inv.id },
      });
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
    }
    throw err;
  }

  /**
   * Idempotent for real. The invite page fires this without awaiting it, so a
   * retry or a double render must not add a second entry — the previous
   * version's "idempotent" comment described intent, not behaviour.
   */
  const [already] = await db
    .select({ id: orgAuditLog.id })
    .from(orgAuditLog)
    .where(
      and(
        eq(orgAuditLog.organizationId, inv.organizationId),
        eq(orgAuditLog.action, "invitation_accepted"),
        sql`${orgAuditLog.metadata} ->> 'invitationId' = ${inv.id}`
      )
    )
    .limit(1);

  if (!already) {
    await logOrgEvent({
      organizationId: inv.organizationId,
      actorId: session.user.id,
      action: "invitation_accepted",
      targetUserId: session.user.id,
      metadata: { email: inv.email, role: inv.role, invitationId: inv.id },
    });
  }

  return NextResponse.json({ ok: true });
}
