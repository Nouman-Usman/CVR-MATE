import { NextRequest, NextResponse } from "next/server";
import { lt, and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  activity,
  emailLog,
  orgAuditLog,
  notification,
  contact,
  companyNote,
  deal,
} from "@/db/schema";
import { invitation } from "@/db/auth-schema";
import { verifyCronRequest } from "@/lib/cron/verify";

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
  // Grace window before soft-deleted CRM personal data is permanently purged.
  // Short window supports GDPR erasure while allowing accidental-delete recovery.
  crmSoftDeleteGrace: 30,
} as const;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Shared with every other cron: QStash signature, else a constant-time
// Bearer comparison. See lib/cron/verify.ts.
const verifyAuth = verifyCronRequest;

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

    // Native-CRM personal data — hard-purge rows soft-deleted beyond the grace
    // window (GDPR erasure of contacts/notes/deals).
    const crmCutoff = daysAgo(RETENTION.crmSoftDeleteGrace);

    const purgedContacts = await db
      .delete(contact)
      .where(and(isNotNull(contact.deletedAt), lt(contact.deletedAt, crmCutoff)))
      .returning({ id: contact.id });
    results.contacts = purgedContacts.length;

    const purgedNotes = await db
      .delete(companyNote)
      .where(and(isNotNull(companyNote.deletedAt), lt(companyNote.deletedAt, crmCutoff)))
      .returning({ id: companyNote.id });
    results.companyNotes = purgedNotes.length;

    const purgedDeals = await db
      .delete(deal)
      .where(and(isNotNull(deal.deletedAt), lt(deal.deletedAt, crmCutoff)))
      .returning({ id: deal.id });
    results.deals = purgedDeals.length;

    /**
     * Retire invitations nobody acted on.
     *
     * Nothing used to move an invitation off `pending`, so the status column
     * disagreed with `expiresAt` forever. The invite route reconciles the one
     * address it is about, but only when someone tries to re-invite — this
     * keeps the whole table honest, so the members screen and the seat count
     * agree about who is actually outstanding.
     *
     * A status change, not a delete: an expired invitation is evidence that
     * someone was invited, which belongs in the audit story.
     */
    const expiredInvites = await db
      .update(invitation)
      .set({ status: "expired" })
      .where(and(eq(invitation.status, "pending"), lt(invitation.expiresAt, new Date())))
      .returning({ id: invitation.id });
    results.expiredInvitations = expiredInvites.length;

    const total = Object.values(results).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      success: true,
      deleted: results,
      total,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[data-cleanup] Failed:", err);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
