export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invitation } from "@/db/auth-schema";
import { eq } from "drizzle-orm";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized } from "@/lib/team/session";

/**
 * POST /api/team/invitations/[invId]/accepted
 *
 * Called by the invite page after a successful authClient.organization.acceptInvitation().
 * Writes the audit log event. Idempotent — safe to call twice.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invId: string }> }
) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const { invId } = await params;

  const inv = await db.query.invitation.findFirst({
    where: eq(invitation.id, invId),
  });
  if (!inv) {
    return NextResponse.json({ ok: true }); // Idempotent — don't error
  }

  await logOrgEvent({
    organizationId: inv.organizationId,
    actorId: session.user.id,
    action: "invitation_accepted",
    targetUserId: session.user.id,
    metadata: { email: inv.email, role: inv.role },
  });

  return NextResponse.json({ ok: true });
}
