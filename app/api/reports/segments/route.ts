import { NextRequest, NextResponse } from "next/server";
import { and, asc, countDistinct, eq, inArray, isNull, sum } from "drizzle-orm";
import { db } from "@/db";
import { segment, companySegment, contract } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";

/**
 * GET /api/reports/segments — per-segment rollup: how many companies are in each
 * segment and the total contract value across those companies. A company in
 * multiple segments contributes to each (segment view, not a partition).
 */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const rows = await db
      .select({
        id: segment.id,
        name: segment.name,
        color: segment.color,
        companyCount: countDistinct(companySegment.companyId),
        contractValue: sum(contract.value),
      })
      .from(segment)
      .leftJoin(companySegment, eq(companySegment.segmentId, segment.id))
      .leftJoin(
        contract,
        and(
          eq(contract.companyId, companySegment.companyId),
          eq(contract.organizationId, organizationId),
          isNull(contract.deletedAt),
          // Only live contracts count toward a segment's value. Summing
          // cancelled and draft ones inflated every segment's figure, which is
          // the kind of error that quietly informs a pricing decision.
          inArray(contract.status, ["active", "renewed"])
        )
      )
      .where(eq(segment.organizationId, organizationId))
      .groupBy(segment.id)
      .orderBy(asc(segment.name));

    const segments = rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      companyCount: Number(r.companyCount ?? 0),
      contractValue: Number(r.contractValue ?? 0),
    }));

    return NextResponse.json({ segments });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
