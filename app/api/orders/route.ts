import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { salesOrder, company } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";

/** GET /api/orders?status= — org's sales orders (newest first), tagged with company. */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const status = req.nextUrl.searchParams.get("status");
    const orders = await db
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
      .where(
        and(
          eq(salesOrder.organizationId, organizationId),
          isNull(salesOrder.deletedAt),
          status ? eq(salesOrder.status, status) : undefined
        )
      )
      .orderBy(desc(salesOrder.createdAt))
      .limit(100);

    return NextResponse.json({ orders });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
