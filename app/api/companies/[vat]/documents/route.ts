import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { quote, salesOrder, company } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { parsePagination } from "@/lib/crm/serialize";

/**
 * GET /api/companies/[vat]/documents — the quotes and orders for one company.
 *
 * The company profile could show contacts, notes, contracts, interactions and
 * activity but not what had been *quoted* to the customer — the single most
 * common question a salesperson opens a company to answer. Both collections in
 * one round trip because the profile renders them together.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vat: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const { vat } = await params;
    const { limit } = parsePagination(req.nextUrl.searchParams);

    const comp = await db.query.company.findFirst({
      where: eq(company.vat, vat),
      columns: { id: true },
    });
    // No local company row means nothing has ever been recorded against it —
    // an empty result, not an error.
    if (!comp) return NextResponse.json({ quotes: [], orders: [] });

    const [quotes, orders] = await Promise.all([
      db
        .select({
          id: quote.id,
          number: quote.number,
          status: quote.status,
          issueDate: quote.issueDate,
          validUntil: quote.validUntil,
          total: quote.total,
          createdAt: quote.createdAt,
        })
        .from(quote)
        .where(
          and(
            eq(quote.organizationId, organizationId),
            eq(quote.companyId, comp.id),
            isNull(quote.deletedAt)
          )
        )
        .orderBy(desc(quote.createdAt))
        .limit(limit),
      db
        .select({
          id: salesOrder.id,
          number: salesOrder.number,
          status: salesOrder.status,
          orderDate: salesOrder.orderDate,
          expectedDelivery: salesOrder.expectedDelivery,
          total: salesOrder.total,
          createdAt: salesOrder.createdAt,
        })
        .from(salesOrder)
        .where(
          and(
            eq(salesOrder.organizationId, organizationId),
            eq(salesOrder.companyId, comp.id),
            isNull(salesOrder.deletedAt)
          )
        )
        .orderBy(desc(salesOrder.createdAt))
        .limit(limit),
    ]);

    return NextResponse.json({ quotes, orders });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
