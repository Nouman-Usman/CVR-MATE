import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { quote, quoteLine, salesOrder, salesOrderLine } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse, CrmConflictError } from "@/lib/crm/guard";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { nextDocumentNumber } from "@/lib/quotes/numbering";
import { assertCanMutateResource } from "@/lib/team/permissions";
import { companyVatById } from "@/lib/crm/company-resolver";

async function loadOwnedQuote(id: string, organizationId: string) {
  const row = await db.query.quote.findFirst({ where: eq(quote.id, id) });
  if (!row || row.organizationId !== organizationId || row.deletedAt) return null;
  return row;
}

/**
 * POST /api/quotes/[id]/convert — turn an ACCEPTED quote into a sales order,
 * copying its lines + totals verbatim (an order is a snapshot; it does not
 * recompute). Marks the quote `converted` and cross-links both ways.
 *
 * Exactly-once by construction: the transaction opens by *claiming* the quote
 * with a conditional UPDATE (`WHERE status='accepted' AND converted_order_id IS
 * NULL`). That write row-locks the quote for the rest of the transaction, so a
 * second concurrent convert finds zero rows and gets a 409 instead of minting a
 * duplicate order.
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
    // Distinguishes "no such quote / not yours" (404) from "wrong state" (409).
    // The authoritative state check is the conditional claim below, not this.
    const q = await loadOwnedQuote(id, organizationId);
    if (!q) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    await assertCanMutateResource(userId, {
      userId: q.createdBy ?? "",
      organizationId: q.organizationId,
    });

    const orderDate = new Date().toISOString().slice(0, 10);

    const order = await db.transaction(async (tx) => {
      // Claim first: this conditional write is what makes convert exactly-once.
      const [claimed] = await tx
        .update(quote)
        .set({ status: "converted" })
        .where(
          and(
            eq(quote.id, q.id),
            eq(quote.organizationId, organizationId),
            isNull(quote.deletedAt),
            eq(quote.status, "accepted"),
            isNull(quote.convertedOrderId)
          )
        )
        .returning();

      if (!claimed) {
        // Lost the race or was never convertible — re-read for an accurate message.
        const current = await tx.query.quote.findFirst({
          where: eq(quote.id, q.id),
          columns: { status: true, convertedOrderId: true },
        });
        throw new CrmConflictError(
          current?.status === "converted" || current?.convertedOrderId
            ? "Quote is already converted."
            : "Only an accepted quote can be converted to an order."
        );
      }

      const lines = await tx.query.quoteLine.findMany({
        where: eq(quoteLine.quoteId, claimed.id),
        orderBy: [asc(quoteLine.sortOrder)],
      });

      const number = await nextDocumentNumber(organizationId, "order", tx);

      const [o] = await tx
        .insert(salesOrder)
        .values({
          organizationId,
          companyId: claimed.companyId,
          dealId: claimed.dealId,
          quoteId: claimed.id,
          createdBy: userId,
          number,
          status: "open",
          currency: claimed.currency,
          orderDate,
          subtotal: claimed.subtotal,
          discountTotal: claimed.discountTotal,
          vatTotal: claimed.vatTotal,
          total: claimed.total,
          notes: claimed.notes,
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
        .set({ convertedOrderId: o.id })
        .where(eq(quote.id, claimed.id));

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

    return NextResponse.json(
      { order, companyVat: await companyVatById(order.companyId) },
      { status: 201 }
    );
  } catch (err) {
    return crmErrorResponse(err);
  }
}
