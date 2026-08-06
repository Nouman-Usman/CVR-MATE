import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quote, quoteLine } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { nextDocumentNumber } from "@/lib/quotes/numbering";
import { companyVatById } from "@/lib/crm/company-resolver";

async function loadOwnedQuote(id: string, organizationId: string) {
  const row = await db.query.quote.findFirst({ where: eq(quote.id, id) });
  if (!row || row.organizationId !== organizationId || row.deletedAt) return null;
  return row;
}

/**
 * POST /api/quotes/[id]/duplicate — copy any quote into a fresh draft.
 *
 * Works from any status: re-quoting a rejected offer or issuing next year's
 * version of an accepted one are the common cases. The copy always starts as a
 * draft with a new number and no lifecycle timestamps — it is a new commercial
 * document, not a revision of the original.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_quote_create", 60, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    const source = await loadOwnedQuote(id, organizationId);
    if (!source) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    const created = await db.transaction(async (tx) => {
      const lines = await tx.query.quoteLine.findMany({
        where: eq(quoteLine.quoteId, source.id),
        orderBy: [asc(quoteLine.sortOrder)],
      });

      // Inside the transaction so a failed insert does not burn a number.
      const number = await nextDocumentNumber(organizationId, "quote", tx);

      const [q] = await tx
        .insert(quote)
        .values({
          organizationId,
          companyId: source.companyId,
          dealId: source.dealId,
          createdBy: userId,
          number,
          status: "draft",
          currency: source.currency,
          issueDate: new Date().toISOString().slice(0, 10),
          // Deliberately not copied: validUntil (dates are relative to issue),
          // and every sent/accepted/rejected timestamp.
          terms: source.terms,
          notes: source.notes,
          subtotal: source.subtotal,
          discountTotal: source.discountTotal,
          vatTotal: source.vatTotal,
          total: source.total,
        })
        .returning();

      if (lines.length) {
        await tx.insert(quoteLine).values(
          lines.map((l) => ({
            quoteId: q.id,
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

      return q;
    });

    await logActivity({
      userId,
      organizationId,
      entityType: "quote",
      entityId: created.id,
      action: "created",
      metadata: {
        companyId: created.companyId,
        number: created.number,
        duplicatedFrom: source.number,
      },
    });

    return NextResponse.json(
      { quote: created, companyVat: await companyVatById(created.companyId) },
      { status: 201 }
    );
  } catch (err) {
    return crmErrorResponse(err);
  }
}
