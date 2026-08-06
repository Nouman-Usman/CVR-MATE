import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { salesOrder, company } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { parsePagination } from "@/lib/crm/serialize";
import { statusValues } from "@/lib/crm/status";

const ORDER_STATUSES = new Set(statusValues("order"));

/** GET /api/orders?status=&limit=&offset= — org's sales orders (newest first), tagged with company. */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const status = req.nextUrl.searchParams.get("status");
    if (status && !ORDER_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const { limit, offset } = parsePagination(req.nextUrl.searchParams);
    const where = and(
      eq(salesOrder.organizationId, organizationId),
      isNull(salesOrder.deletedAt),
      status ? eq(salesOrder.status, status) : undefined
    );

    const [orders, [{ value: total }]] = await Promise.all([
      db
        .select({
          id: salesOrder.id,
          number: salesOrder.number,
          status: salesOrder.status,
          companyId: salesOrder.companyId,
          companyVat: company.vat,
          companyName: company.name,
          currency: salesOrder.currency,
          orderDate: salesOrder.orderDate,
          expectedDelivery: salesOrder.expectedDelivery,
          total: salesOrder.total,
          createdAt: salesOrder.createdAt,
        })
        .from(salesOrder)
        .innerJoin(company, eq(salesOrder.companyId, company.id))
        .where(where)
        .orderBy(desc(salesOrder.createdAt))
        .limit(limit)
        .offset(offset),
      // Same join as the page query, so `total` can't disagree with what paging returns.
      db
        .select({ value: count() })
        .from(salesOrder)
        .innerJoin(company, eq(salesOrder.companyId, company.id))
        .where(where),
    ]);

    return NextResponse.json({ orders, total });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
