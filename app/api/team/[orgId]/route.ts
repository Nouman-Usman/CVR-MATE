export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organization } from "@/db/auth-schema";
import { leadTrigger, savedCompany, todo } from "@/db/app-schema";
import { eq, and, isNotNull, count } from "drizzle-orm";
import {
  assertPermission,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized, badRequest, conflict } from "@/lib/team/session";

/**
 * PATCH /api/team/[orgId] — Rename an organization.
 * Requires owner/admin.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const { orgId } = await params;
  const body = await req.json().catch(() => ({}));
  const { name } = body as { name?: string };

  if (!name?.trim()) return badRequest("Organization name is required");

  try {
    await assertPermission(session.user.id, orgId, "rename_org");
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: teamErrorToStatus(err) });
    }
    throw err;
  }

  // Get current org for audit log
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, orgId),
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const previousName = org.name;

  await db
    .update(organization)
    .set({ name: name.trim() })
    .where(eq(organization.id, orgId));

  await logOrgEvent({
    organizationId: orgId,
    actorId: session.user.id,
    action: "org_renamed",
    metadata: { previousName, newName: name.trim() },
  });

  return NextResponse.json({ ok: true, name: name.trim() });
}

/**
 * DELETE /api/team/[orgId] — Delete an organization.
 *
 * Owner-only. Blocks deletion if org-scoped data exists (triggers, saved
 * companies, or todos) to prevent silent data loss.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const { orgId } = await params;

  try {
    await assertPermission(session.user.id, orgId, "delete_org");
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: teamErrorToStatus(err) });
    }
    throw err;
  }

  // Check for org-scoped data — block deletion to prevent data loss
  const [triggerRows, savedRows, todoRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(leadTrigger)
      .where(and(eq(leadTrigger.organizationId, orgId), isNotNull(leadTrigger.organizationId))),
    db
      .select({ value: count() })
      .from(savedCompany)
      .where(and(eq(savedCompany.organizationId, orgId), isNotNull(savedCompany.organizationId))),
    db
      .select({ value: count() })
      .from(todo)
      .where(and(eq(todo.organizationId, orgId), isNotNull(todo.organizationId))),
  ]);

  const totalOrgData =
    (triggerRows[0]?.value ?? 0) +
    (savedRows[0]?.value ?? 0) +
    (todoRows[0]?.value ?? 0);

  if (totalOrgData > 0) {
    return conflict(
      "Transfer or delete all shared team resources before deleting the organization. " +
        `Found: ${triggerRows[0]?.value ?? 0} triggers, ${savedRows[0]?.value ?? 0} saved companies, ${todoRows[0]?.value ?? 0} tasks.`
    );
  }

  // Audit log BEFORE delete (cascade will remove the audit rows too, so log first)
  await logOrgEvent({
    organizationId: orgId,
    actorId: session.user.id,
    action: "org_deleted",
    metadata: {},
  });

  // Delete org — cascades to members, invitations, audit log
  await db.delete(organization).where(eq(organization.id, orgId));

  return NextResponse.json({ ok: true });
}
