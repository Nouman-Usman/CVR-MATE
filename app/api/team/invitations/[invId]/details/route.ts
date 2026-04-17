export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invitation, organization, user } from "@/db/auth-schema";
import { member } from "@/db/auth-schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

/**
 * GET /api/team/invitations/[invId]/details
 *
 * Public endpoint — returns a safe subset of invitation data for the
 * invite preview page. Does NOT require authentication so the invitee
 * can see the preview before logging in.
 *
 * If the requester is authenticated, also returns whether they're already
 * a member of the org.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ invId: string }> }
) {
  const { invId } = await params;
  if (!invId) {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });
  }

  const inv = await db.query.invitation.findFirst({
    where: eq(invitation.id, invId),
  });

  // Generic error — don't leak whether the ID exists
  if (!inv) {
    return NextResponse.json({ error: "Invalid invitation", status: "not_found" }, { status: 404 });
  }

  // Get org name
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, inv.organizationId),
  });

  // Get inviter name
  const inviter = await db.query.user.findFirst({
    where: eq(user.id, inv.inviterId),
  });

  // Determine status
  const now = new Date();
  let status: "pending" | "expired" | "accepted" | "rejected" | "canceled" = inv.status as "pending" | "accepted" | "rejected" | "canceled";

  if (inv.status === "pending" && inv.expiresAt < now) {
    status = "expired";
  }

  // Check if requester is already a member (if authenticated)
  let isAlreadyMember = false;
  let isInvitee = false;
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) {
      const existing = await db.query.member.findFirst({
        where: and(
          eq(member.userId, session.user.id),
          eq(member.organizationId, inv.organizationId)
        ),
      });
      isAlreadyMember = !!existing;
      isInvitee = session.user.email?.toLowerCase() === inv.email.toLowerCase();
    }
  } catch {
    // Not authenticated — fine
  }

  return NextResponse.json({
    id: inv.id,
    organizationName: org?.name ?? "Unknown organization",
    inviterName: inviter?.name ?? "A team member",
    role: inv.role,
    email: inv.email,
    status,
    expiresAt: inv.expiresAt.toISOString(),
    isAlreadyMember,
    isInvitee,
  });
}
