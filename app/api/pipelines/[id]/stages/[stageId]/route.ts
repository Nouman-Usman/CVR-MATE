import { NextRequest, NextResponse } from "next/server";
import { eq, count } from "drizzle-orm";
import { db } from "@/db";
import { pipelineStage, deal } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { loadOwnedStage } from "@/lib/crm/pipeline";
import { parseBody, stageUpdateSchema } from "@/lib/validation/crm";

/** PATCH /api/pipelines/[id]/stages/[stageId] — rename / recolor / flag won-lost. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const { id, stageId } = await params;
    const stage = await loadOwnedStage(stageId, organizationId);
    if (!stage || stage.pipelineId !== id) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    const parsed = parseBody(stageUpdateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    const patch: Partial<typeof pipelineStage.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.color !== undefined) patch.color = input.color ?? null;
    // Won and lost are mutually exclusive.
    if (input.isWon !== undefined) {
      patch.isWon = input.isWon;
      if (input.isWon) patch.isLost = false;
    }
    if (input.isLost !== undefined) {
      patch.isLost = input.isLost;
      if (input.isLost) patch.isWon = false;
    }

    const [row] = await db
      .update(pipelineStage)
      .set(patch)
      .where(eq(pipelineStage.id, stageId))
      .returning();
    return NextResponse.json({ stage: row });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** DELETE /api/pipelines/[id]/stages/[stageId] — only when no deals reference it. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const { id, stageId } = await params;
    const stage = await loadOwnedStage(stageId, organizationId);
    if (!stage || stage.pipelineId !== id) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    // A stage with any deals (incl. soft-deleted, which keep a restrict FK)
    // cannot be removed — the user must reassign first.
    const [{ value: dealCount }] = await db
      .select({ value: count() })
      .from(deal)
      .where(eq(deal.stageId, stageId));
    if (dealCount > 0) {
      return NextResponse.json(
        { error: `Move the ${dealCount} deal(s) in this stage before deleting it.` },
        { status: 409 }
      );
    }

    await db.delete(pipelineStage).where(eq(pipelineStage.id, stageId));
    return NextResponse.json({ message: "Stage deleted" });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
