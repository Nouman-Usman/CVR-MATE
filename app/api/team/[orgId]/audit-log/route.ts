import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orgAuditLog, user } from "@/db/schema";
import { getTeamSession, unauthorized } from "@/lib/team/session";
import { assertUserIsMemberOfOrg, assertOrgPlanActive, TeamPermissionError } from "@/lib/team/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const { orgId } = await params;

  try {
    // Verify active Enterprise plan before exposing org data
    await assertOrgPlanActive(orgId);
    // Only admins and owners can view the audit log
    const membership = await assertUserIsMemberOfOrg(session.user.id, orgId);
    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json({ error: "Only admins and owners can view the audit log" }, { status: 403 });
    }
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "PLAN_NOT_ALLOWED" ? 402 : 403 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select({
      id: orgAuditLog.id,
      action: orgAuditLog.action,
      targetUserId: orgAuditLog.targetUserId,
      metadata: orgAuditLog.metadata,
      createdAt: orgAuditLog.createdAt,
      actorName: user.name,
      actorEmail: user.email,
    })
    .from(orgAuditLog)
    .leftJoin(user, eq(orgAuditLog.actorId, user.id))
    .where(eq(orgAuditLog.organizationId, orgId))
    .orderBy(desc(orgAuditLog.createdAt))
    .limit(50);

  return NextResponse.json({ events: rows });
}
