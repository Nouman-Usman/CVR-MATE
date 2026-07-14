import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { deal, pipelineStage, contact } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import {
  getOrCreateDefaultPipeline,
  loadOwnedPipeline,
  deriveStatusFromStage,
} from "@/lib/crm/pipeline";
import { resolveCompanyIdByVat } from "@/lib/crm/company-resolver";
import { parseBody, dealCreateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { getOrgMembership } from "@/lib/team/permissions";

/** GET /api/deals?pipelineId= — deals for a pipeline (defaults to the org default). */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  try {
    const pipelineId = req.nextUrl.searchParams.get("pipelineId");
    let resolvedPipelineId = pipelineId;
    if (resolvedPipelineId) {
      if (!(await loadOwnedPipeline(resolvedPipelineId, organizationId))) {
        return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
      }
    } else {
      resolvedPipelineId = (await getOrCreateDefaultPipeline(organizationId, userId)).id;
    }

    const deals = await db.query.deal.findMany({
      where: and(
        eq(deal.organizationId, organizationId),
        eq(deal.pipelineId, resolvedPipelineId),
        isNull(deal.deletedAt)
      ),
      orderBy: [desc(deal.createdAt)],
      with: {
        company: { columns: { id: true, vat: true, name: true, industryName: true } },
        assignedUser: { columns: { id: true, name: true, image: true } },
        primaryContact: { columns: { id: true, name: true } },
      },
    });

    return NextResponse.json({ pipelineId: resolvedPipelineId, deals });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** POST /api/deals — create a deal in a pipeline/stage. */
export async function POST(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_deal_create", 60, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const parsed = parseBody(dealCreateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    // Company
    const companyId =
      input.companyId ?? (input.cvr ? await resolveCompanyIdByVat(input.cvr) : null);
    if (!companyId) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    // Pipeline (provided or default)
    const pipe = input.pipelineId
      ? await (async () => {
          const p = await loadOwnedPipeline(input.pipelineId!, organizationId);
          if (!p) return null;
          const stages = await db.query.pipelineStage.findMany({
            where: eq(pipelineStage.pipelineId, p.id),
            orderBy: [asc(pipelineStage.position)],
          });
          return { ...p, stages };
        })()
      : await getOrCreateDefaultPipeline(organizationId, userId);
    if (!pipe) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

    // Stage: provided (must belong to this pipeline) or the first stage.
    const stage = input.stageId
      ? pipe.stages.find((s) => s.id === input.stageId)
      : pipe.stages[0];
    if (!stage) {
      return NextResponse.json(
        { error: "Stage not found in this pipeline" },
        { status: 400 }
      );
    }

    // Optional assignee must be an org member.
    if (input.assignedUserId) {
      const membership = await getOrgMembership(input.assignedUserId, organizationId);
      if (!membership) {
        return NextResponse.json({ error: "Assignee is not a member of this org" }, { status: 400 });
      }
    }
    // Optional primary contact must belong to this org + company.
    if (input.primaryContactId) {
      const c = await db.query.contact.findFirst({
        where: and(
          eq(contact.id, input.primaryContactId),
          eq(contact.organizationId, organizationId),
          eq(contact.companyId, companyId),
          isNull(contact.deletedAt)
        ),
        columns: { id: true },
      });
      if (!c) return NextResponse.json({ error: "Invalid primary contact" }, { status: 400 });
    }

    const status = deriveStatusFromStage(stage);
    const now = new Date();
    const [row] = await db
      .insert(deal)
      .values({
        organizationId,
        companyId,
        pipelineId: pipe.id,
        stageId: stage.id,
        title: input.title,
        amount: input.amount != null ? String(input.amount) : null,
        currency: input.currency ?? "DKK",
        closeDate: input.closeDate ?? null,
        assignedUserId: input.assignedUserId ?? null,
        primaryContactId: input.primaryContactId ?? null,
        status,
        stageChangedAt: now,
        wonAt: status === "won" ? now : null,
        lostAt: status === "lost" ? now : null,
        createdBy: userId,
      })
      .returning();

    await logActivity({
      userId,
      organizationId,
      entityType: "deal",
      entityId: row.id,
      action: "created",
      metadata: { companyId, title: row.title, stageId: stage.id },
    });

    return NextResponse.json({ deal: row }, { status: 201 });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
