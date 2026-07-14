import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, count } from "drizzle-orm";
import { db } from "@/db";
import { pipeline, deal } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { loadOwnedPipeline } from "@/lib/crm/pipeline";
import { parseBody, pipelineUpdateSchema } from "@/lib/validation/crm";

/** PATCH /api/pipelines/[id] — rename or set as default. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const { id } = await params;
    const existing = await loadOwnedPipeline(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

    const parsed = parseBody(pipelineUpdateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { name, isDefault } = parsed.data;

    const updated = await db.transaction(async (tx) => {
      // Only one default per org — clear the others first.
      if (isDefault === true) {
        await tx
          .update(pipeline)
          .set({ isDefault: false })
          .where(
            and(eq(pipeline.organizationId, organizationId), eq(pipeline.isDefault, true))
          );
      }
      const patch: Partial<typeof pipeline.$inferInsert> = {};
      if (name !== undefined) patch.name = name;
      if (isDefault !== undefined) patch.isDefault = isDefault;
      const [row] = await tx
        .update(pipeline)
        .set(patch)
        .where(eq(pipeline.id, id))
        .returning();
      return row;
    });

    return NextResponse.json({ pipeline: updated });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** DELETE /api/pipelines/[id] — remove a non-default, deal-free pipeline. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const { id } = await params;
    const existing = await loadOwnedPipeline(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

    if (existing.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete the default pipeline." },
        { status: 409 }
      );
    }

    // Block if it still holds active deals — the user must move them first.
    const [{ value: activeDeals }] = await db
      .select({ value: count() })
      .from(deal)
      .where(and(eq(deal.pipelineId, id), isNull(deal.deletedAt)));
    if (activeDeals > 0) {
      return NextResponse.json(
        { error: `Move or delete the ${activeDeals} deal(s) in this pipeline first.` },
        { status: 409 }
      );
    }

    // Clear stale soft-deleted deals (they hold a restrict FK to stages), then
    // delete the pipeline — stages cascade.
    await db.transaction(async (tx) => {
      await tx.delete(deal).where(eq(deal.pipelineId, id));
      await tx.delete(pipeline).where(eq(pipeline.id, id));
    });

    return NextResponse.json({ message: "Pipeline deleted" });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
