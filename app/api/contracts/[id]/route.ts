import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contract, deal } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { parseBody, contractUpdateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import {
  assertCanMutateResource,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";

/** Load a contract and enforce org ownership (IDOR defense — no DB RLS). */
async function loadOwnedContract(id: string, organizationId: string) {
  const row = await db.query.contract.findFirst({ where: eq(contract.id, id) });
  if (!row || row.organizationId !== organizationId || row.deletedAt) return null;
  return row;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const { id } = await params;
    const row = await loadOwnedContract(id, organizationId);
    if (!row) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    return NextResponse.json({ contract: row });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_contract_update", 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    const existing = await loadOwnedContract(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

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

    const parsed = parseBody(contractUpdateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    if (input.dealId) {
      const ok = await db.query.deal.findFirst({
        where: and(
          eq(deal.id, input.dealId),
          eq(deal.organizationId, organizationId),
          eq(deal.companyId, existing.companyId)
        ),
        columns: { id: true },
      });
      if (!ok) return NextResponse.json({ error: "Deal not found" }, { status: 400 });
    }

    const updateData: Partial<typeof contract.$inferInsert> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.startDate !== undefined) updateData.startDate = input.startDate ?? null;
    if (input.expiryDate !== undefined) updateData.expiryDate = input.expiryDate ?? null;
    if (input.value !== undefined) updateData.value = input.value ?? null;
    if (input.currency !== undefined) updateData.currency = input.currency ?? "DKK";
    if (input.renewalNoticeDays !== undefined) updateData.renewalNoticeDays = input.renewalNoticeDays;
    if (input.autoRenew !== undefined) updateData.autoRenew = input.autoRenew;
    if (input.externalRef !== undefined) updateData.externalRef = input.externalRef ?? null;
    if (input.notes !== undefined) updateData.notes = input.notes ?? null;
    if (input.dealId !== undefined) updateData.dealId = input.dealId ?? null;
    // Editing the renewal window/expiry re-arms the reminder.
    if (input.expiryDate !== undefined || input.renewalNoticeDays !== undefined) {
      updateData.renewalNotifiedAt = null;
    }

    const [updated] = await db
      .update(contract)
      .set(updateData)
      .where(eq(contract.id, existing.id))
      .returning();

    await logActivity({
      userId,
      organizationId,
      entityType: "contract",
      entityId: updated.id,
      action: "updated",
      metadata: { companyId: updated.companyId, title: updated.title },
    });

    return NextResponse.json({ contract: updated });
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
    const existing = await loadOwnedContract(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

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

    await db
      .update(contract)
      .set({ deletedAt: new Date() })
      .where(eq(contract.id, existing.id));

    await logActivity({
      userId,
      organizationId,
      entityType: "contract",
      entityId: existing.id,
      action: "deleted",
      metadata: { companyId: existing.companyId },
    });

    return NextResponse.json({ message: "Contract deleted" });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
