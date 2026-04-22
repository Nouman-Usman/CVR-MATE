export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invitation, organization, member } from "@/db/auth-schema";
import { user } from "@/db/auth-schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import {
  assertPermission,
  assertSeatAvailable,
  assertOrgPlanActive,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized, badRequest } from "@/lib/team/session";
import { sendTeamInvitationEmail } from "@/lib/email/senders/team-invitation";

export async function POST(req: NextRequest) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { email, role, organizationId } = body as {
    email?: string;
    role?: string;
    organizationId?: string;
  };

  if (!email?.trim()) return badRequest("Email is required");
  if (!organizationId) return badRequest("Organization ID is required");

  const memberRole = role === "admin" ? "admin" : "member";

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

  // Check if already a member
  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, email.trim().toLowerCase()),
  });
  if (existingUser) {
    const existingMember = await db.query.member.findFirst({
      where: and(
        eq(member.userId, existingUser.id),
        eq(member.organizationId, organizationId)
      ),
    });
    if (existingMember) {
      return badRequest("This user is already a member of the organization");
    }
  }

  // Check for existing pending invite to same email
  const existingInvite = await db.query.invitation.findFirst({
    where: and(
      eq(invitation.email, email.trim().toLowerCase()),
      eq(invitation.organizationId, organizationId),
      eq(invitation.status, "pending")
    ),
  });
  if (existingInvite) {
    return badRequest("An invitation has already been sent to this email");
  }

  // Seat check (race-condition safe via count check)
  try {
    await assertSeatAvailable(organizationId);
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      await logOrgEvent({
        organizationId,
        actorId: session.user.id,
        action: "seat_limit_reached",
        metadata: { targetEmail: email },
      });
      return NextResponse.json({ error: err.message, code: err.code }, { status: teamErrorToStatus(err) });
    }
    throw err;
  }

  // Get org details for the email
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, organizationId),
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Create invitation (7-day expiry)
  const invitationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(invitation).values({
    id: invitationId,
    organizationId,
    email: email.trim().toLowerCase(),
    role: memberRole,
    status: "pending",
    expiresAt,
    inviterId: session.user.id,
  });

  // Send invitation email
  const baseUrl =
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "https://cvr-mate.vercel.app";

  try {
    await sendTeamInvitationEmail({
      to: email.trim(),
      inviterName: session.user.name,
      organizationName: org.name,
      inviteUrl: `${baseUrl}/invite/${invitationId}`,
      role: memberRole,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[team/invite] Email send failed:", err);
    // Invitation is still created — admin can resend or share the link
  }

  await logOrgEvent({
    organizationId,
    actorId: session.user.id,
    action: "member_invited",
    metadata: { email: email.trim(), role: memberRole, invitationId },
  });

  return NextResponse.json({ ok: true, invitationId });
}
