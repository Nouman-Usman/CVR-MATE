import { NextRequest, NextResponse } from "next/server";
import { lt, and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activity, emailLog, orgAuditLog, notification } from "@/db/schema";
import { verifyQStashRequest } from "@/lib/qstash";

export const runtime = "nodejs";

// ─── Retention policy (days) ─────────────────────────────────────────────────
//
// These values balance storage costs with operational needs and Danish GDPR
// requirements. Adjust and document in your privacy policy before shipping.
const RETENTION = {
  // Rolling operational log — 90 days is sufficient for debugging
  activity: 90,
  // Email delivery records — kept long enough to investigate bounces
  emailLog: 90,
  // Compliance audit trail — 1 year minimum for GDPR accountability
  orgAuditLog: 365,
  // Read notifications — no value after 30 days
  readNotifications: 30,
} as const;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function verifyAuth(req: NextRequest): Promise<boolean> {
  if (await verifyQStashRequest(req)) return true;
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  return !!cronSecret && auth === `Bearer ${cronSecret}`;
}

/**
 * POST /api/cron/data-cleanup
 *
 * QStash-scheduled data retention job. Purges records older than the policy
 * window from high-volume tables. Should run once per day.
 *
 * Schedule via QStash: POST https://qstash.upstash.io/v2/schedules
 *   cron: "0 3 * * *"  (03:00 UTC daily)
 *   destination: https://your-domain.com/api/cron/data-cleanup
 */
export async function POST(req: NextRequest) {
  if (!(await verifyAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, number> = {};

  try {
    // activity — rolling operational log
    const activityCutoff = daysAgo(RETENTION.activity);
    const deletedActivity = await db
      .delete(activity)
      .where(lt(activity.createdAt, activityCutoff))
      .returning({ id: activity.id });
    results.activity = deletedActivity.length;

    // email_log — delivery records
    const emailCutoff = daysAgo(RETENTION.emailLog);
    const deletedEmail = await db
      .delete(emailLog)
      .where(lt(emailLog.createdAt, emailCutoff))
      .returning({ id: emailLog.id });
    results.emailLog = deletedEmail.length;

    // org_audit_log — compliance trail
    const auditCutoff = daysAgo(RETENTION.orgAuditLog);
    const deletedAudit = await db
      .delete(orgAuditLog)
      .where(lt(orgAuditLog.createdAt, auditCutoff))
      .returning({ id: orgAuditLog.id });
    results.orgAuditLog = deletedAudit.length;

    // notifications — only purge ones the user has already read
    const notifCutoff = daysAgo(RETENTION.readNotifications);
    const deletedNotif = await db
      .delete(notification)
      .where(
        and(
          lt(notification.createdAt, notifCutoff),
          eq(notification.isRead, true) // keep unread — user may not have seen them yet
        )
      )
      .returning({ id: notification.id });
    results.readNotifications = deletedNotif.length;

    const total = Object.values(results).reduce((a, b) => a + b, 0);
    console.log(`[data-cleanup] Deleted ${total} rows:`, results);

    return NextResponse.json({
      success: true,
      deleted: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[data-cleanup] Failed:", err);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
