import { NextRequest, NextResponse } from "next/server";
import { eq, count, countDistinct } from "drizzle-orm";
import { db } from "@/db";
import { matchFeedItem, changeFeedCursor } from "@/db/schema";
import { requireAdmin, writeAdminAudit, getAdminClientIp } from "@/lib/admin/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { runMatchFeed, MATCH_FEED_CURSOR } from "@/lib/match-feed/run";
import { toFeedDate } from "@/lib/match-feed/generate";

export const runtime = "nodejs";
export const maxDuration = 300;

const STALE_LOCK_MS = 30 * 60 * 1000;

/**
 * GET /api/admin/match-feed
 * Admin-only status snapshot for the daily match-feed cron:
 * last run, lock state, and today's / total feed volume.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const now = new Date();
    const today = toFeedDate(now);
    const staleCutoff = new Date(now.getTime() - STALE_LOCK_MS);

    const [cursor, generatedToday, pending, usersWithPending, totalItems] = await Promise.all([
      db.query.changeFeedCursor.findFirst({
        where: eq(changeFeedCursor.feedType, MATCH_FEED_CURSOR),
      }),
      db.select({ v: count() }).from(matchFeedItem)
        .where(eq(matchFeedItem.feedDate, today)).then((r) => r[0]?.v ?? 0),
      db.select({ v: count() }).from(matchFeedItem)
        .where(eq(matchFeedItem.status, "pending")).then((r) => r[0]?.v ?? 0),
      db.select({ v: countDistinct(matchFeedItem.userId) }).from(matchFeedItem)
        .where(eq(matchFeedItem.status, "pending")).then((r) => r[0]?.v ?? 0),
      db.select({ v: count() }).from(matchFeedItem).then((r) => r[0]?.v ?? 0),
    ]);

    return NextResponse.json({
      lastRunAt: cursor?.processedAt ?? null,
      isProcessing: cursor?.isProcessing ?? false,
      processingStartedAt: cursor?.processingStartedAt ?? null,
      lockStale: !!(
        cursor?.isProcessing &&
        cursor.processingStartedAt &&
        cursor.processingStartedAt < staleCutoff
      ),
      generatedToday,
      pending,
      usersWithPending,
      totalItems,
    });
  } catch (error) {
    console.error("Admin match-feed status failed:", error);
    return NextResponse.json({ error: "Failed to load match-feed status" }, { status: 500 });
  }
}

/**
 * POST /api/admin/match-feed  { action: "run_now" }
 * Runs the daily match-feed generation inline (same code path as the QStash
 * cron) and returns the run result. Same-day idempotency still applies — users
 * already generated today are reported as skippedAlreadyToday, not re-run.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const rl = await checkRateLimit(admin, "admin_match_feed_run", 10, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many runs, slow down." }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body.action !== "run_now") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const ip = await getAdminClientIp();
    const result = await runMatchFeed();

    await writeAdminAudit({
      actorEmail: admin,
      action: "match_feed_run",
      targetType: "cron",
      targetId: MATCH_FEED_CURSOR,
      metadata: result as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Admin match-feed run failed:", error);
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}
