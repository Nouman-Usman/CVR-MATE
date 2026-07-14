import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { deal, contact } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { loadOwnedDeal, loadOwnedStage, deriveStatusFromStage } from "@/lib/crm/pipeline";
import { parseBody, dealUpdateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity, type ActivityAction } from "@/lib/activity/log";
import { logOrgEvent } from "@/lib/team/audit";
import { getOrgMembership } from "@/lib/team/permissions";

/** GET /api/deals/[id] — a single deal with relations. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const { id } = await params;
    if (!(await loadOwnedDeal(id, organizationId))) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    const row = await db.query.deal.findFirst({
      where: eq(deal.id, id),
      with: {
        company: { columns: { id: true, vat: true, name: true } },
        assignedUser: { columns: { id: true, name: true, image: true } },
        primaryContact: { columns: { id: true, name: true } },
        stage: true,
      },
    });
    return NextResponse.json({ deal: row });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** PATCH /api/deals/[id] — edit fields or move to a new stage (kanban drag). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_deal_update", 180, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    const existing = await loadOwnedDeal(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    const parsed = parseBody(dealUpdateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    const patch: Partial<typeof deal.$inferInsert> = {};
    let stageChanged = false;
    let terminalAction: ActivityAction | null = null;

    if (input.title !== undefined) patch.title = input.title;
    if (input.amount !== undefined) patch.amount = input.amount != null ? String(input.amount) : null;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.closeDate !== undefined) patch.closeDate = input.closeDate ?? null;
    if (input.lostReason !== undefined) patch.lostReason = input.lostReason ?? null;

    // Assignee change — must be an org member (or cleared).
    if (input.assignedUserId !== undefined) {
      if (input.assignedUserId) {
        const membership = await getOrgMembership(input.assignedUserId, organizationId);
        if (!membership) {
          return NextResponse.json({ error: "Assignee is not a member of this org" }, { status: 400 });
        }
      }
      patch.assignedUserId = input.assignedUserId ?? null;
    }

    // Primary contact change — must belong to this org + the deal's company.
    if (input.primaryContactId !== undefined) {
      if (input.primaryContactId) {
        const c = await db.query.contact.findFirst({
          where: and(
            eq(contact.id, input.primaryContactId),
            eq(contact.organizationId, organizationId),
            eq(contact.companyId, existing.companyId),
            isNull(contact.deletedAt)
          ),
          columns: { id: true },
        });
        if (!c) return NextResponse.json({ error: "Invalid primary contact" }, { status: 400 });
      }
      patch.primaryContactId = input.primaryContactId ?? null;
    }

    // Stage move — the target stage must be in the SAME pipeline and org.
    if (input.stageId !== undefined && input.stageId !== existing.stageId) {
      const stage = await loadOwnedStage(input.stageId, organizationId);
      if (!stage || stage.pipelineId !== existing.pipelineId) {
        return NextResponse.json(
          { error: "Target stage is not part of this deal's pipeline." },
          { status: 400 }
        );
      }
      const status = deriveStatusFromStage(stage);
      const now = new Date();
      patch.stageId = stage.id;
      patch.stageChangedAt = now;
      patch.status = status;
      patch.wonAt = status === "won" ? existing.wonAt ?? now : null;
      patch.lostAt = status === "lost" ? existing.lostAt ?? now : null;
      stageChanged = true;
      terminalAction = status === "won" ? "won" : status === "lost" ? "lost" : null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db.update(deal).set(patch).where(eq(deal.id, id)).returning();

    if (stageChanged) {
      await logActivity({
        userId,
        organizationId,
        entityType: "deal",
        entityId: id,
        action: terminalAction ?? "stage_changed",
        metadata: {
          companyId: existing.companyId,
          fromStageId: existing.stageId,
          toStageId: patch.stageId,
        },
      });
    } else {
      await logActivity({
        userId,
        organizationId,
        entityType: "deal",
        entityId: id,
        action: "updated",
        metadata: { companyId: existing.companyId },
      });
    }

    return NextResponse.json({ deal: updated });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** DELETE /api/deals/[id] — soft delete. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  try {
    const { id } = await params;
    const existing = await loadOwnedDeal(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    await db.update(deal).set({ deletedAt: new Date() }).where(eq(deal.id, id));

    await logActivity({
      userId,
      organizationId,
      entityType: "deal",
      entityId: id,
      action: "deleted",
      metadata: { companyId: existing.companyId },
    });
    await logOrgEvent({
      organizationId,
      actorId: userId,
      action: "crm_deal_deleted",
      metadata: { dealId: id, companyId: existing.companyId },
    });

    return NextResponse.json({ message: "Deal deleted" });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
