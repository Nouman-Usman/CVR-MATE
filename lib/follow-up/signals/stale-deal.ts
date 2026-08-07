import "server-only";

import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { deal } from "@/db/schema";

import { daysAgo, daysSinceInstant } from "../time";
import type { FollowUpSignal, SignalContext } from "../types";

/**
 * A deal that has not moved stage in a while.
 *
 * The weakest signal here, deliberately: a deal can legitimately sit in
 * Proposal for three weeks while a quote is with the customer's finance team.
 * It earns its place because it is the only signal that needs no other object —
 * it catches deals nobody has done anything with at all.
 *
 * This is the signal the pipeline board has been computing and throwing away:
 * `app/pipeline/page.tsx` colours a dot from `stageChangedAt` and nothing reads
 * it. Same input, now with somewhere to go.
 */

interface StaleDealRow {
  id: string;
  companyId: string;
  title: string;
  amount: number | null;
  stageChangedAt: Date | null;
  createdAt: Date;
}

export const staleDealSignal: FollowUpSignal<StaleDealRow> = {
  key: "stale_deal",
  baseWeight: 20,

  async select(ctx: SignalContext) {
    const cutoff = daysAgo(ctx.now, ctx.config.staleDays);
    return db
      .select({
        id: deal.id,
        companyId: deal.companyId,
        title: deal.title,
        amount: deal.amount,
        stageChangedAt: deal.stageChangedAt,
        createdAt: deal.createdAt,
      })
      .from(deal)
      .where(
        and(
          eq(deal.organizationId, ctx.organizationId),
          eq(deal.status, "open"),
          isNull(deal.deletedAt),
          // `stageChangedAt` is null for a deal that has never moved, and those
          // are exactly the deals most likely to be neglected. Written as an OR
          // over two indexable predicates rather than COALESCE, which would
          // force a sequential scan.
          or(
            lt(deal.stageChangedAt, cutoff),
            and(isNull(deal.stageChangedAt), lt(deal.createdAt, cutoff))
          )
        )
      )
      .orderBy(asc(sql`coalesce(${deal.stageChangedAt}, ${deal.createdAt})`))
      .limit(ctx.limit);
  },

  evaluate(row, ctx) {
    const since = row.stageChangedAt ?? row.createdAt;
    const days = daysSinceInstant(since, ctx.now);
    if (days < ctx.config.staleDays) return null;

    return {
      companyId: row.companyId,
      dealId: row.id,
      signalKey: "stale_deal",
      entityId: "*",
      reason: { key: "staleDeal", params: { days } },
      // Grows with neglect but saturates: a deal stale for 200 days is not
      // twenty times more urgent than one stale for 24.
      urgency: Math.min(30, days - ctx.config.staleDays),
      daysDelta: days,
      amountOre: row.amount,
    };
  },
};
