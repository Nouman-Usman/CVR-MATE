export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invitation } from "@/db/auth-schema";
import { eq } from "drizzle-orm";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized, badRequest } from "@/lib/team/session";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * POST /api/team/invitations/[invId]/decline — Decline an invitation.
 *
 * Only the invitee (matched by session email === invitation email) can decline.
 * No org membership check — the invitee is not yet a member.
 * Frees the seat immediately instead of waiting for expiry.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invId: string }> }
) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const { invId } = await params;

  const rl = await checkRateLimit(session.user.id, "invite_decline", 20, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);
  if (!invId) return badRequest("Invitation ID is required");

  const inv = await db.query.invitation.findFirst({
    where: eq(invitation.id, invId),
  });
  if (!inv) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  // Only the invitee can decline
  if (inv.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "You can only decline invitations sent to your email" },
      { status: 403 }
    );
  }

  if (inv.status !== "pending") {
    return badRequest("Invitation is no longer pending");
  }

  // Mark as rejected (frees the seat immediately)
  await db
    .update(invitation)
    .set({ status: "rejected" })
    .where(eq(invitation.id, invId));

  await logOrgEvent({
    organizationId: inv.organizationId,
    actorId: session.user.id,
    action: "invitation_declined",
    metadata: { email: inv.email, role: inv.role },
  });

  return NextResponse.json({ ok: true });
}
