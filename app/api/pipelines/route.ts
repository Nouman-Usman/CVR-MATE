import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pipeline, pipelineStage } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { getOrCreateDefaultPipeline, DEFAULT_STAGES } from "@/lib/crm/pipeline";
import { parseBody, pipelineCreateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";

/** GET /api/pipelines — list org pipelines with ordered stages (seeds default). */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  try {
    // Ensure the org has at least its default pipeline.
    await getOrCreateDefaultPipeline(organizationId, userId);

    const pipelines = await db.query.pipeline.findMany({
      where: eq(pipeline.organizationId, organizationId),
      orderBy: [asc(pipeline.createdAt)],
      with: { stages: { orderBy: [asc(pipelineStage.position)] } },
    });

    return NextResponse.json({ pipelines });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** POST /api/pipelines — create a custom pipeline seeded with default stages. */
export async function POST(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_pipeline_create", 30, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const parsed = parseBody(pipelineCreateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const created = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(pipeline)
        .values({
          organizationId,
          name: parsed.data.name,
          isDefault: false,
          createdBy: userId,
        })
        .returning();
      await tx.insert(pipelineStage).values(
        DEFAULT_STAGES.map((s, i) => ({
          pipelineId: p.id,
          organizationId,
          name: s.name,
          position: i,
          color: s.color,
          isWon: s.isWon ?? false,
          isLost: s.isLost ?? false,
        }))
      );
      const stages = await tx.query.pipelineStage.findMany({
        where: eq(pipelineStage.pipelineId, p.id),
        orderBy: [asc(pipelineStage.position)],
      });
      return { ...p, stages };
    });

    return NextResponse.json({ pipeline: created }, { status: 201 });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
