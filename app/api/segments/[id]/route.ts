import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { segment } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { parseBody, segmentUpdateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import {
  assertCanMutateResource,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";

async function loadOwnedSegment(id: string, organizationId: string) {
  const row = await db.query.segment.findFirst({ where: eq(segment.id, id) });
  if (!row || row.organizationId !== organizationId) return null;
  return row;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_segment_update", 60, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    const existing = await loadOwnedSegment(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Segment not found" }, { status: 404 });

    try {
      await assertCanMutateResource(userId, {
        userId: existing.createdBy ?? "",
        organizationId: existing.organizationId,
      });
    } catch (err) {
      if (err instanceof TeamPermissionError) {
        return NextResponse.json({ error: err.message }, { status: teamErrorToStatus(err) });
      }
      throw err;
    }

    const parsed = parseBody(segmentUpdateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    // A renamed segment must still be unique within the org.
    if (input.name !== undefined && input.name !== existing.name) {
      const dup = await db.query.segment.findFirst({
        where: and(
          eq(segment.organizationId, organizationId),
          eq(segment.name, input.name),
          ne(segment.id, existing.id)
        ),
        columns: { id: true },
      });
      if (dup) {
        return NextResponse.json({ error: "A segment with this name already exists." }, { status: 409 });
      }
    }

    const updateData: Partial<typeof segment.$inferInsert> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.color !== undefined) updateData.color = input.color ?? "#94a3b8";
    if (input.description !== undefined) updateData.description = input.description ?? null;

    const [updated] = await db
      .update(segment)
      .set(updateData)
      .where(eq(segment.id, existing.id))
      .returning();

    await logActivity({
      userId,
      organizationId,
      entityType: "segment",
      entityId: updated.id,
      action: "updated",
      metadata: { name: updated.name },
    });

    return NextResponse.json({ segment: updated });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  try {
    const { id } = await params;
    const existing = await loadOwnedSegment(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Segment not found" }, { status: 404 });

    try {
      await assertCanMutateResource(userId, {
        userId: existing.createdBy ?? "",
        organizationId: existing.organizationId,
      });
    } catch (err) {
      if (err instanceof TeamPermissionError) {
        return NextResponse.json({ error: err.message }, { status: teamErrorToStatus(err) });
      }
      throw err;
    }

    // Hard delete — company_segment rows cascade away via FK.
    await db.delete(segment).where(eq(segment.id, existing.id));

    await logActivity({
      userId,
      organizationId,
      entityType: "segment",
      entityId: existing.id,
      action: "deleted",
      metadata: { name: existing.name },
    });

    return NextResponse.json({ message: "Segment deleted" });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
