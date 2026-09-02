export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organization } from "@/db/auth-schema";
import { eq } from "drizzle-orm";
import {
  assertPermission,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized, badRequest, conflict } from "@/lib/team/session";
import { blockingTotal, describeCensus, orgDataCensus } from "@/lib/team/org-data-census";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validation/crm";
import { renameOrgSchema } from "@/lib/validation/team";

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

  const rl = await checkRateLimit(session.user.id, "team_rename_org", 30, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  const parsed = parseBody(renameOrgSchema, await req.json().catch(() => ({})));
  if (!parsed.ok) return badRequest(parsed.error);
  const { name } = parsed.data;

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
 * Owner-only, and refuses while the organization still owns anything.
 *
 * The refusal is the whole safety mechanism. Deleting the org row triggers two
 * different fates at the database level — CRM data is destroyed by CASCADE,
 * while saved companies, todos, follows and CRM connections are SET NULL, which
 * quietly makes them the personal property of whoever created them. Neither is
 * something a user should discover after the fact, so the org must be emptied
 * deliberately first. See `lib/team/org-data-census.ts` for the full inventory.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const { orgId } = await params;

  // Destroys an organization and everything cascading from it.
  const rl = await checkRateLimit(session.user.id, "team_delete_org", 5, 3600);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    await assertPermission(session.user.id, orgId, "delete_org");
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: teamErrorToStatus(err) });
    }
    throw err;
  }

  // Every org-scoped table, not just the three that used to be checked here.
  const census = await orgDataCensus(orgId);
  if (blockingTotal(census) > 0) {
    return conflict(
      "Transfer or delete all shared team resources before deleting the organization. " +
        `Found: ${describeCensus(census)}.`,
      { census }
    );
  }

  // Audit log BEFORE delete (cascade will remove the audit rows too, so log first)
  await logOrgEvent({
    organizationId: orgId,
    actorId: session.user.id,
    action: "org_deleted",
    metadata: {},
  });

  // Safe by construction: the census above proved the org owns nothing, so the
  // cascade has only membership and bookkeeping rows left to remove.
  await db.delete(organization).where(eq(organization.id, orgId));

  return NextResponse.json({ ok: true });
}
