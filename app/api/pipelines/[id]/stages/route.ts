import { NextRequest, NextResponse } from "next/server";
import { asc, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { pipelineStage } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { loadOwnedPipeline } from "@/lib/crm/pipeline";
import { parseBody, stageCreateSchema, stageReorderSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";

/** GET /api/pipelines/[id]/stages — ordered stages of a pipeline. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const { id } = await params;
    if (!(await loadOwnedPipeline(id, organizationId))) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }
    const stages = await db.query.pipelineStage.findMany({
      where: eq(pipelineStage.pipelineId, id),
      orderBy: [asc(pipelineStage.position)],
    });
    return NextResponse.json({ stages });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** POST /api/pipelines/[id]/stages — append a stage. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_stage_create", 60, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    if (!(await loadOwnedPipeline(id, organizationId))) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }
    const parsed = parseBody(stageCreateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    const [{ value: maxPos }] = await db
      .select({ value: max(pipelineStage.position) })
      .from(pipelineStage)
      .where(eq(pipelineStage.pipelineId, id));

    const [row] = await db
      .insert(pipelineStage)
      .values({
        pipelineId: id,
        organizationId,
        name: input.name,
        position: input.position ?? (maxPos ?? -1) + 1,
        color: input.color ?? null,
        isWon: input.isWon ?? false,
        isLost: input.isLost ?? false,
      })
      .returning();

    await logActivity({
      userId,
      organizationId,
      entityType: "stage",
      entityId: row.id,
      action: "created",
      metadata: { name: row.name, pipelineId: id, position: row.position },
    });

    return NextResponse.json({ stage: row }, { status: 201 });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** PATCH /api/pipelines/[id]/stages — reorder stages (full ordered id list). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  try {
    const { id } = await params;
    if (!(await loadOwnedPipeline(id, organizationId))) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }
    const parsed = parseBody(stageReorderSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    // All ids must belong to this pipeline (and thus this org).
    const owned = await db.query.pipelineStage.findMany({
      where: eq(pipelineStage.pipelineId, id),
      columns: { id: true },
    });
    const ownedIds = new Set(owned.map((s) => s.id));
    if (
      parsed.data.orderedStageIds.length !== ownedIds.size ||
      !parsed.data.orderedStageIds.every((sid) => ownedIds.has(sid))
    ) {
      return NextResponse.json(
        { error: "orderedStageIds must list exactly the stages of this pipeline." },
        { status: 400 }
      );
    }

    await db.transaction(async (tx) => {
      // Two-phase to avoid transient position collisions: park to negatives,
      // then set final positions.
      for (let i = 0; i < parsed.data.orderedStageIds.length; i++) {
        await tx
          .update(pipelineStage)
          .set({ position: -1 - i })
          .where(eq(pipelineStage.id, parsed.data.orderedStageIds[i]));
      }
      for (let i = 0; i < parsed.data.orderedStageIds.length; i++) {
        await tx
          .update(pipelineStage)
          .set({ position: i })
          .where(eq(pipelineStage.id, parsed.data.orderedStageIds[i]));
      }
    });

    const stages = await db.query.pipelineStage.findMany({
      where: eq(pipelineStage.pipelineId, id),
      orderBy: [asc(pipelineStage.position)],
    });
    // Logged against the pipeline, not a stage: reordering is one change to the
    // board's shape, not N independent stage edits.
    await logActivity({
      userId,
      organizationId,
      entityType: "pipeline",
      entityId: id,
      action: "updated",
      metadata: { reordered: stages.map((s) => s.name) },
    });

    return NextResponse.json({ stages });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
