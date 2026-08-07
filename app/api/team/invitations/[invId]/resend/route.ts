export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { invitation, organization } from "@/db/auth-schema";
import {
  assertPermission,
  assertOrgPlanActive,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized, badRequest } from "@/lib/team/session";
import { sendTeamInvitationEmail } from "@/lib/email/senders/team-invitation";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";

const INVITE_TTL_DAYS = 7;

/**
 * POST /api/team/invitations/[invId]/resend
 *
 * Send an existing invitation again and push its expiry out.
 *
 * The invite route used to swallow mail failures with a comment saying the
 * admin could resend — but no resend existed, and the duplicate check then
 * rejected every retry, so one transient failure produced an invitation nobody
 * could act on and no way to fix it short of cancelling and starting over.
 *
 * Resending also renews the clock, because the reason to resend is almost
 * always that the original was missed or is about to lapse.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invId: string }> }
) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();
  const { invId } = await params;

  // Tighter than the invite limit: this targets one already-known address, so
  // a high rate is only ever nagging.
  const rl = await checkRateLimit(session.user.id, "invite_resend", 10, 3600);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  const inv = await db.query.invitation.findFirst({ where: eq(invitation.id, invId) });
  if (!inv) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });

  try {
    await assertOrgPlanActive(inv.organizationId);
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
    }
    throw err;
  }

  try {
    await assertPermission(session.user.id, inv.organizationId, "invite_member");
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: teamErrorToStatus(err) });
    }
    throw err;
  }

  // An accepted, declined or cancelled invitation is finished; resending one
  // would be a new invitation, which is what /api/team/invite is for.
  if (inv.status !== "pending" && inv.status !== "expired") {
    return badRequest(`This invitation is already ${inv.status}`);
  }

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, inv.organizationId),
  });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  /**
   * Revive an expired invitation in the same step, guarded on the status we
   * read. `invitation_pending_uq` means this cannot resurrect a second live
   * invitation for an address that already has one.
   */
  const [revived] = await db
    .update(invitation)
    .set({ status: "pending", expiresAt })
    .where(and(eq(invitation.id, inv.id), eq(invitation.status, inv.status)))
    .returning({ id: invitation.id });

  if (!revived) {
    return NextResponse.json(
      { error: "Invitation changed while resending — reload and try again" },
      { status: 409 }
    );
  }

  const baseUrl = process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "https://cvr-mate.dk";
  const inviteUrl = `${baseUrl}/invite/${inv.id}`;

  let emailed = true;
  let emailError: string | undefined;
  try {
    await sendTeamInvitationEmail({
      to: inv.email,
      inviterName: session.user.name,
      inviterEmail: session.user.email,
      recipientName: inv.email.split("@")[0],
      organizationName: org.name,
      inviteUrl,
      role: inv.role,
      expiresAt: expiresAt.toISOString(),
      inviterId: session.user.id,
    });
  } catch (err) {
    console.error("[team/invite/resend] Email send failed:", err);
    emailed = false;
    emailError = err instanceof Error ? err.message : "Unknown error";
  }

  await logOrgEvent({
    organizationId: inv.organizationId,
    actorId: session.user.id,
    action: "member_invited",
    metadata: { email: inv.email, role: inv.role, invitationId: inv.id, resend: true, emailed },
  });

  return NextResponse.json({ ok: true, emailed, emailError, inviteUrl });
}
