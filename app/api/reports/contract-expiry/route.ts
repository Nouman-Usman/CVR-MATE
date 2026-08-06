import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { contract } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";

// Cancelled and draft contracts are history, not portfolio — counting their
// value in "total value" overstated what the org actually holds. They still
// count as rows, they just contribute nothing to any sum.
const liveValue = sql`case when ${contract.status} in ('active','renewed') then coalesce(${contract.value}, 0) else 0 end`;

// `date - date` is an integer day count in Postgres, so these edges land exactly
// where the old JS `Math.floor((expiry - today) / 86400000)` did. A null expiry
// makes every comparison null, which is why such rows can only match `none`.
const days = sql`(${contract.expiryDate} - current_date)`;

const EXPIRED = sql`${days} < 0`;
const D30 = sql`${days} between 0 and 30`;
const D60 = sql`${days} between 31 and 60`;
const D90 = sql`${days} between 61 and 90`;
const LATER = sql`${days} > 90`;
const NONE = sql`${contract.expiryDate} is null`;

const bucketCount = (match: SQL) => sql<number>`count(*) filter (where ${match})`;
// Sums stay exact: `value` is integer øre, and sum(bigint) is numeric, never float.
const bucketValue = (match: SQL) =>
  sql<number>`coalesce(sum(${liveValue}) filter (where ${match}), 0)`;

/**
 * GET /api/reports/contract-expiry — the org's contracts bucketed by how soon
 * they expire (relative to today), for the reports dashboard. Bucketing happens
 * in one aggregate query, so the response costs six counts and six sums rather
 * than every contract row in the org.
 */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const [row] = await db
      .select({
        expiredCount: bucketCount(EXPIRED),
        expiredValue: bucketValue(EXPIRED),
        d30Count: bucketCount(D30),
        d30Value: bucketValue(D30),
        d60Count: bucketCount(D60),
        d60Value: bucketValue(D60),
        d90Count: bucketCount(D90),
        d90Value: bucketValue(D90),
        laterCount: bucketCount(LATER),
        laterValue: bucketValue(LATER),
        noneCount: bucketCount(NONE),
        noneValue: bucketValue(NONE),
        totalCount: sql<number>`count(*)`,
        totalValue: sql<number>`coalesce(sum(${liveValue}), 0)`,
        activeCount: sql<number>`count(*) filter (where ${contract.status} = 'active')`,
        expiringSoon: sql<number>`count(*) filter (where ${contract.status} = 'active' and ${D30})`,
      })
      .from(contract)
      .where(and(eq(contract.organizationId, organizationId), isNull(contract.deletedAt)));

    const buckets = [
      { key: "expired", count: Number(row.expiredCount), value: Number(row.expiredValue) },
      { key: "d30", count: Number(row.d30Count), value: Number(row.d30Value) },
      { key: "d60", count: Number(row.d60Count), value: Number(row.d60Value) },
      { key: "d90", count: Number(row.d90Count), value: Number(row.d90Value) },
      { key: "later", count: Number(row.laterCount), value: Number(row.laterValue) },
      { key: "none", count: Number(row.noneCount), value: Number(row.noneValue) },
    ];

    return NextResponse.json({
      buckets,
      totals: {
        count: Number(row.totalCount),
        value: Number(row.totalValue),
        active: Number(row.activeCount),
        expiringSoon: Number(row.expiringSoon),
      },
    });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
