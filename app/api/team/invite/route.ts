export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invitation, organization, member, user } from "@/db/auth-schema";
import { eq, and, lt, sql } from "drizzle-orm";
import crypto from "crypto";
import {
  assertPermission,
  assertSeatAvailable,
  assertOrgPlanActive,
  TeamPermissionError,
  teamErrorToStatus,
  type TeamErrorCode,
} from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized, badRequest } from "@/lib/team/session";
import { sendTeamInvitationEmail } from "@/lib/email/senders/team-invitation";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validation/crm";
import { inviteMemberSchema } from "@/lib/validation/team";

const INVITE_TTL_DAYS = 7;

const DUPLICATE_INVITE = "An invitation is already pending for this email";

/**
 * How the invite transaction ended.
 *
 * Tagged rather than thrown, because neither failure is exceptional: both are
 * ordinary outcomes with their own HTTP response, and throwing would roll back
 * a transaction that has nothing to undo while flattening the reason.
 */
type InviteOutcome =
  | { status: "created" }
  | { status: "duplicate" }
  | { status: "no_seats"; message: string; code: TeamErrorCode };

/**
 * POST /api/team/invite — invite someone to an organization.
 *
 * This endpoint sends mail to an address the caller supplies, so it is rate
 * limited: without one, a single admin session could be used to bombard an
 * address from your domain, which costs you sender reputation, not just noise.
 */
export async function POST(req: NextRequest) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const parsed = parseBody(inviteMemberSchema, await req.json().catch(() => ({})));
  if (!parsed.ok) return badRequest(parsed.error);
  const { email, role: memberRole, organizationId } = parsed.data;

  // Generous enough for onboarding a real team in one sitting, tight enough
  // that the endpoint cannot be used as a mail cannon.
  const rl = await checkRateLimit(session.user.id, "team_invite", 20, 3600);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  // Plan check — inviting requires an active Enterprise subscription
  try {
    await assertOrgPlanActive(organizationId);
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
    }
    throw err;
  }

  // RBAC check — only owner/admin can invite
  try {
    await assertPermission(session.user.id, organizationId, "invite_member");
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      await logOrgEvent({
        organizationId,
        actorId: session.user.id,
        action: "permission_denied",
        metadata: { attemptedAction: "invite_member", targetEmail: email },
      });
      return NextResponse.json({ error: err.message, code: err.code }, { status: teamErrorToStatus(err) });
    }
    throw err;
  }

  /**
   * Retire invitations that have run out of time before looking for duplicates.
   *
   * Nothing else ever moved an invitation off `pending`, while the duplicate
   * check below matched on status alone — so eight days after a forgotten
   * invite, re-inviting that person failed permanently with "an invitation has
   * already been sent". Seat counting already ignored expired rows, so the two
   * checks disagreed about what "pending" meant.
   */
  await db
    .update(invitation)
    .set({ status: "expired" })
    .where(
      and(
        eq(invitation.organizationId, organizationId),
        eq(invitation.email, email),
        eq(invitation.status, "pending"),
        lt(invitation.expiresAt, new Date())
      )
    );

  // Already a member?
  const existingUser = await db.query.user.findFirst({ where: eq(user.email, email) });
  if (existingUser) {
    const existingMember = await db.query.member.findFirst({
      where: and(eq(member.userId, existingUser.id), eq(member.organizationId, organizationId)),
    });
    if (existingMember) {
      return badRequest("This user is already a member of the organization");
    }
  }

  // Still-live invitation to the same address?
  const existingInvite = await db.query.invitation.findFirst({
    where: and(
      eq(invitation.email, email),
      eq(invitation.organizationId, organizationId),
      eq(invitation.status, "pending")
    ),
  });
  if (existingInvite) {
    return NextResponse.json(
      {
        error: "An invitation is already pending for this email",
        code: "INVITE_ALREADY_PENDING",
        invitationId: existingInvite.id,
      },
      { status: 409 }
    );
  }

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, organizationId),
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const invitationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  /**
   * Seat check and insert share one transaction.
   *
   * Seats. Inert while every Enterprise plan is unlimited (teamMemberLimit -1)
   * and every other plan is rejected by assertOrgPlanActive above — kept so a
   * seat-priced tier only needs a config change, not new enforcement code. That
   * promise only holds if the check cannot be raced, which is why it runs in the
   * same transaction as the row it is guarding rather than before it.
   *
   * The duplicate check further up is a SELECT, so it cannot be the enforcement
   * either — two concurrent requests both pass it. `invitation_pending_uq` is
   * the authority; zero rows back means another request won the race.
   */
  const outcome: InviteOutcome = await db.transaction(async (tx) => {
    try {
      await assertSeatAvailable(organizationId, tx);
    } catch (err) {
      if (err instanceof TeamPermissionError) {
        return { status: "no_seats", message: err.message, code: err.code };
      }
      throw err;
    }

    const inserted = await tx
      .insert(invitation)
      .values({
        id: invitationId,
        organizationId,
        email,
        role: memberRole,
        status: "pending",
        expiresAt,
        inviterId: session.user.id,
      })
      .onConflictDoNothing({
        target: [invitation.organizationId, invitation.email],
        // `where` is the index predicate for onConflictDoNothing (targetWhere
        // is the onConflictDoUpdate spelling). It must match
        // invitation_pending_uq exactly or Postgres will not arbitrate on it.
        where: sql`status = 'pending'`,
      })
      .returning({ id: invitation.id });

    return inserted.length === 0 ? { status: "duplicate" } : { status: "created" };
  });

  if (outcome.status === "duplicate") {
    return NextResponse.json(
      { error: DUPLICATE_INVITE, code: "INVITE_ALREADY_PENDING" },
      { status: 409 }
    );
  }

  if (outcome.status === "no_seats") {
    await logOrgEvent({
      organizationId,
      actorId: session.user.id,
      action: "seat_limit_reached",
      metadata: { targetEmail: email },
    });
    return NextResponse.json(
      { error: outcome.message, code: outcome.code },
      { status: teamErrorToStatus(new TeamPermissionError(outcome.code, outcome.message)) }
    );
  }

  /**
   * A failed send used to be swallowed with a comment saying the admin could
   * resend — but there was no resend, and the duplicate check then rejected
   * every retry, so a transient mail failure produced an invitation nobody
   * could act on. The invitation is still worth keeping (the link works), so
   * the outcome is reported instead of hidden.
   */
  let emailed = true;
  let emailError: string | undefined;
  const baseUrl = process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "https://cvr-mate.dk";
  try {
    await sendTeamInvitationEmail({
      to: email,
      inviterName: session.user.name,
      inviterEmail: session.user.email,
      recipientName: email.split("@")[0],
      organizationName: org.name,
      inviteUrl: `${baseUrl}/invite/${invitationId}`,
      role: memberRole,
      expiresAt: expiresAt.toISOString(),
      inviterId: session.user.id,
    });
  } catch (err) {
    console.error("[team/invite] Email send failed:", err);
    emailed = false;
    emailError = err instanceof Error ? err.message : "Unknown error";
  }

  await logOrgEvent({
    organizationId,
    actorId: session.user.id,
    action: "member_invited",
    metadata: { email, role: memberRole, invitationId, emailed },
  });

  return NextResponse.json({
    ok: true,
    invitationId,
    emailed,
    emailError,
    inviteUrl: `${baseUrl}/invite/${invitationId}`,
  });
}
