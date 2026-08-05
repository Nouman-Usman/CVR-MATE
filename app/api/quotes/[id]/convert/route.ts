import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quote, quoteLine, salesOrder, salesOrderLine } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { nextDocumentNumber } from "@/lib/quotes/numbering";

async function loadOwnedQuote(id: string, organizationId: string) {
  const row = await db.query.quote.findFirst({ where: eq(quote.id, id) });
  if (!row || row.organizationId !== organizationId || row.deletedAt) return null;
  return row;
}

/**
 * POST /api/quotes/[id]/convert — turn an ACCEPTED quote into a sales order,
 * copying its lines + totals verbatim (an order is a snapshot; it does not
 * recompute). Marks the quote `converted` and cross-links both ways. Idempotent
 * guard: a quote already converted returns 409.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_quote_convert", 60, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    const q = await loadOwnedQuote(id, organizationId);
    if (!q) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    if (q.status === "converted" || q.convertedOrderId) {
      return NextResponse.json({ error: "Quote is already converted." }, { status: 409 });
    }
    if (q.status !== "accepted") {
      return NextResponse.json(
        { error: "Only an accepted quote can be converted to an order." },
        { status: 409 }
      );
    }

    const lines = await db.query.quoteLine.findMany({
      where: eq(quoteLine.quoteId, q.id),
      orderBy: [asc(quoteLine.sortOrder)],
    });

    const number = await nextDocumentNumber(organizationId, "order");
    const orderDate = new Date().toISOString().slice(0, 10);

    const order = await db.transaction(async (tx) => {
      const [o] = await tx
        .insert(salesOrder)
        .values({
          organizationId,
          companyId: q.companyId,
          dealId: q.dealId,
          quoteId: q.id,
          createdBy: userId,
          number,
          status: "open",
          currency: q.currency,
          orderDate,
          subtotal: q.subtotal,
          discountTotal: q.discountTotal,
          vatTotal: q.vatTotal,
          total: q.total,
          notes: q.notes,
        })
        .returning();

      if (lines.length) {
        await tx.insert(salesOrderLine).values(
          lines.map((l) => ({
            orderId: o.id,
            organizationId,
            productId: l.productId,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountPct: l.discountPct,
            vatRate: l.vatRate,
            lineSubtotal: l.lineSubtotal,
            lineDiscount: l.lineDiscount,
            lineVat: l.lineVat,
            lineTotal: l.lineTotal,
            sortOrder: l.sortOrder,
          }))
        );
      }

      await tx
        .update(quote)
        .set({ status: "converted", convertedOrderId: o.id })
        .where(eq(quote.id, q.id));

      return o;
    });

    await logActivity({
      userId,
      organizationId,
      entityType: "order",
      entityId: order.id,
      action: "created",
      metadata: { companyId: q.companyId, number: order.number, fromQuote: q.number },
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
