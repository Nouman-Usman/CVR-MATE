import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pipelineStage, deal } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { loadOwnedPipeline } from "@/lib/crm/pipeline";

/**
 * GET /api/pipelines/[id]/board — kanban data: ordered stages each with their
 * open deals (joined with company / assignee / primary contact), org-scoped.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const { id } = await params;
    const pipe = await loadOwnedPipeline(id, organizationId);
    if (!pipe) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

    const [stages, deals] = await Promise.all([
      db.query.pipelineStage.findMany({
        where: eq(pipelineStage.pipelineId, id),
        orderBy: [asc(pipelineStage.position)],
      }),
      db.query.deal.findMany({
        where: and(
          eq(deal.organizationId, organizationId),
          eq(deal.pipelineId, id),
          isNull(deal.deletedAt)
        ),
        orderBy: [desc(deal.createdAt)],
        with: {
          company: { columns: { id: true, vat: true, name: true, industryName: true } },
          assignedUser: { columns: { id: true, name: true, image: true } },
          primaryContact: { columns: { id: true, name: true } },
        },
      }),
    ]);

    // Group deals by stage for the columns.
    const byStage: Record<string, typeof deals> = {};
    for (const s of stages) byStage[s.id] = [];
    for (const d of deals) (byStage[d.stageId] ??= []).push(d);

    const columns = stages.map((s) => ({
      stage: s,
      deals: byStage[s.id] ?? [],
    }));

    return NextResponse.json({
      pipeline: { id: pipe.id, name: pipe.name, isDefault: pipe.isDefault },
      columns,
    });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
