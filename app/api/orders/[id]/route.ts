import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { salesOrder, salesOrderLine, company } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { parseBody, orderUpdateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";

async function loadOwnedOrder(id: string, organizationId: string) {
  const row = await db.query.salesOrder.findFirst({ where: eq(salesOrder.id, id) });
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
    const row = await loadOwnedOrder(id, organizationId);
    if (!row) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const [lines, comp] = await Promise.all([
      db.query.salesOrderLine.findMany({
        where: eq(salesOrderLine.orderId, row.id),
        orderBy: [asc(salesOrderLine.sortOrder)],
      }),
      db.query.company.findFirst({
        where: eq(company.id, row.companyId),
        columns: { vat: true, name: true },
      }),
    ]);

    return NextResponse.json({ order: row, lines, company: comp ?? null });
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

  const rl = await checkRateLimit(userId, "crm_order_update", 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    const existing = await loadOwnedOrder(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const parsed = parseBody(orderUpdateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    const patch: Partial<typeof salesOrder.$inferInsert> = {};
    if (input.expectedDelivery !== undefined) {
      patch.expectedDelivery = input.expectedDelivery ?? null;
    }
    if (input.notes !== undefined) patch.notes = input.notes ?? null;
    if (input.status !== undefined) {
      patch.status = input.status;
      // Stamp the confirmation time the first time it's confirmed.
      if (input.status === "confirmed" && !existing.confirmedAt) {
        patch.confirmedAt = new Date();
      }
    }

    const [updated] = await db
      .update(salesOrder)
      .set(patch)
      .where(eq(salesOrder.id, existing.id))
      .returning();

    await logActivity({
      userId,
      organizationId,
      entityType: "order",
      entityId: updated.id,
      action: "updated",
      metadata: { companyId: updated.companyId, number: updated.number, status: updated.status },
    });

    return NextResponse.json({ order: updated });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
