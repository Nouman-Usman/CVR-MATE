import { NextResponse } from "next/server";
import { eq, and, lt, gte, isNotNull, count, sql } from "drizzle-orm";
import { db } from "@/db";
import { leadTrigger, triggerResult, changeFeedCursor, user } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/require-admin";

const STALE_MIN = 30;

/**
 * GET /api/admin/health
 * Job/cron health: overdue triggers, run volume, and change-feed lock state.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const staleCutoff = new Date(now.getTime() - STALE_MIN * 60 * 1000);

    const [overdue, activeCount, pausedCount, runs24h, runs7d, matches7d, cursors] = await Promise.all([
      db.select({
        id: leadTrigger.id, name: leadTrigger.name, email: user.email,
        frequency: leadTrigger.frequency, nextRunAt: leadTrigger.nextRunAt, lastRunAt: leadTrigger.lastRunAt,
      })
        .from(leadTrigger).innerJoin(user, eq(leadTrigger.userId, user.id))
        .where(and(eq(leadTrigger.isActive, true), isNotNull(leadTrigger.nextRunAt), lt(leadTrigger.nextRunAt, now)))
        .orderBy(leadTrigger.nextRunAt).limit(50),

      db.select({ value: count() }).from(leadTrigger).where(eq(leadTrigger.isActive, true)).then((r) => r[0]?.value ?? 0),
      db.select({ value: count() }).from(leadTrigger).where(eq(leadTrigger.isActive, false)).then((r) => r[0]?.value ?? 0),
      db.select({ value: count() }).from(triggerResult).where(gte(triggerResult.createdAt, dayAgo)).then((r) => r[0]?.value ?? 0),
      db.select({ value: count() }).from(triggerResult).where(gte(triggerResult.createdAt, weekAgo)).then((r) => r[0]?.value ?? 0),
      db.select({ value: sql<number>`coalesce(sum(${triggerResult.matchCount}), 0)` }).from(triggerResult)
        .where(gte(triggerResult.createdAt, weekAgo)).then((r) => Number(r[0]?.value ?? 0)),

      db.select({
        feedType: changeFeedCursor.feedType, isProcessing: changeFeedCursor.isProcessing,
        processingStartedAt: changeFeedCursor.processingStartedAt, processedAt: changeFeedCursor.processedAt,
        lastChangeId: changeFeedCursor.lastChangeId,
      }).from(changeFeedCursor),
    ]);

    const cursorsWithStale = cursors.map((c) => ({
      ...c,
      stale: c.isProcessing && !!c.processingStartedAt && new Date(c.processingStartedAt) < staleCutoff,
    }));

    return NextResponse.json({
      generatedAt: now.toISOString(),
      triggers: { active: activeCount, paused: pausedCount, overdue: overdue.length, runs24h, runs7d, matches7d },
      overdueTriggers: overdue,
      cursors: cursorsWithStale,
      staleLocks: cursorsWithStale.filter((c) => c.stale).length,
    });
  } catch (error) {
    console.error("Admin health failed:", error);
    return NextResponse.json({ error: "Failed to load health" }, { status: 500 });
  }
}
