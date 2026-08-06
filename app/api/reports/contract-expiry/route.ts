import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { contract } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";

/**
 * GET /api/reports/contract-expiry — the org's contracts bucketed by how soon
 * they expire (relative to today), for the reports dashboard. Contract counts
 * per org are small, so the bucketing runs in JS.
 */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const rows = await db.query.contract.findMany({
      where: and(eq(contract.organizationId, organizationId), isNull(contract.deletedAt)),
      columns: { expiryDate: true, value: true, status: true },
    });

    const today = Date.parse(new Date().toISOString().slice(0, 10));
    const DAY = 86_400_000;
    const bucket = () => ({ count: 0, value: 0 });
    const b = {
      expired: bucket(),
      d30: bucket(),
      d60: bucket(),
      d90: bucket(),
      later: bucket(),
      none: bucket(),
    };

    let totalCount = 0;
    let totalValue = 0;
    let activeCount = 0;
    let expiringSoon = 0; // active + expiring within 30 days

    // Cancelled contracts are history, not portfolio — counting their value in
    // "total value" overstated what the org actually holds.
    const LIVE = new Set(["active", "renewed"]);

    for (const r of rows) {
      const val = LIVE.has(r.status) ? (r.value ?? 0) : 0;
      totalCount++;
      totalValue += val;
      if (r.status === "active") activeCount++;

      let slot: ReturnType<typeof bucket>;
      if (!r.expiryDate) {
        slot = b.none;
      } else {
        const days = Math.floor((Date.parse(r.expiryDate) - today) / DAY);
        if (days < 0) slot = b.expired;
        else if (days <= 30) {
          slot = b.d30;
          if (r.status === "active") expiringSoon++;
        } else if (days <= 60) slot = b.d60;
        else if (days <= 90) slot = b.d90;
        else slot = b.later;
      }
      slot.count++;
      slot.value += val;
    }

    const buckets = [
      { key: "expired", ...b.expired },
      { key: "d30", ...b.d30 },
      { key: "d60", ...b.d60 },
      { key: "d90", ...b.d90 },
      { key: "later", ...b.later },
      { key: "none", ...b.none },
    ];

    return NextResponse.json({
      buckets,
      totals: { count: totalCount, value: totalValue, active: activeCount, expiringSoon },
    });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
