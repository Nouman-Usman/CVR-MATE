import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, userBrand } from "@/db/schema";
import { sendDailyLeadUpdateEmail } from "./senders/daily-lead-update";
import { sendWeeklySummaryEmail } from "./senders/weekly-summary";
import { sendMatchFeedReadyEmail } from "./senders/match-feed-ready";
import { sendAnnualReportDigestEmail } from "./senders/annual-report-digest";
import type {
  EmailQueuePayload,
  DailyLeadUpdateData,
  WeeklySummaryData,
  MatchFeedReadyData,
  AnnualReportDigestData,
} from "./types";

type SendResult =
  | { sent: true; provider: string; to: string }
  | { skipped: true; reason: string };

/**
 * Shared logic used by both the QStash receiver (/api/email/notify) and the
 * localhost direct-send path.
 * Fetches the user, enforces opt-out preferences, then renders + sends.
 */
export async function sendNotificationEmail(
  payload: EmailQueuePayload
): Promise<SendResult> {
  const { templateId, userId, data } = payload;

  // ── Fetch user ─────────────────────────────────────────────────────────
  const [userRow] = await db
    .select({ id: user.id, email: user.email, name: user.name, language: user.language })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userRow) return { skipped: true, reason: "user_not_found" };

  // ── Check opt-out preferences ──────────────────────────────────────────
  const brand = await db.query.userBrand.findFirst({
    where: eq(userBrand.userId, userId),
    columns: {
      emailNotificationsEnabled: true,
      dailyLeadEmails: true,
      weeklySummaryEmails: true,
      annualReportEmails: true,
    },
  });

  const prefs = brand ?? {
    emailNotificationsEnabled: true,
    dailyLeadEmails: true,
    weeklySummaryEmails: true,
    annualReportEmails: true,
  };

  if (!prefs.emailNotificationsEnabled)
    return { skipped: true, reason: "notifications_disabled" };
  if (templateId === "daily_lead_update" && !prefs.dailyLeadEmails)
    return { skipped: true, reason: "daily_leads_disabled" };
  // Its own opt-out: annual-report alerts are a different category of mail
  // from lead discovery, so they must not ride someone else's consent toggle.
  // In-app notifications are unaffected by this preference.
  if (templateId === "annual_report_digest" && !prefs.annualReportEmails)
    return { skipped: true, reason: "annual_reports_disabled" };
  // Match-feed emails ride the same "daily leads" opt-out.
  if (templateId === "match_feed" && !prefs.dailyLeadEmails)
    return { skipped: true, reason: "daily_leads_disabled" };
  if (templateId === "weekly_summary" && !prefs.weeklySummaryEmails)
    return { skipped: true, reason: "weekly_summary_disabled" };

  // ── Send ───────────────────────────────────────────────────────────────
  let result;
  if (templateId === "daily_lead_update") {
    result = await sendDailyLeadUpdateEmail({
      to: userRow.email,
      userName: userRow.name,
      userId,
      data: data as DailyLeadUpdateData,
      language: (userRow.language as "en" | "da") || "da",
    });
  } else if (templateId === "match_feed") {
    result = await sendMatchFeedReadyEmail({
      to: userRow.email,
      userName: userRow.name,
      userId,
      data: data as MatchFeedReadyData,
      language: (userRow.language as "en" | "da") || "da",
    });
  } else if (templateId === "annual_report_digest") {
    result = await sendAnnualReportDigestEmail({
      to: userRow.email,
      userName: userRow.name,
      userId,
      data: data as AnnualReportDigestData,
      language: (userRow.language as "en" | "da") || "da",
    });
  } else if (templateId === "weekly_summary") {
    result = await sendWeeklySummaryEmail({
      to: userRow.email,
      userName: userRow.name,
      userId,
      data: data as WeeklySummaryData,
      language: (userRow.language as "en" | "da") || "da",
    });
  } else {
    throw new Error(`[email/dispatch] Unknown templateId: ${templateId}`);
  }

  return { sent: true, provider: result.provider, to: userRow.email };
}

/**
 * Route a notification email to the right delivery path:
 *
 *   localhost  →  send directly (QStash is cloud-only, can't reach localhost)
 *   production →  enqueue via QStash for reliable async delivery with retries
 */
export async function dispatchNotificationEmail(
  payload: EmailQueuePayload
): Promise<void> {
  const baseUrl =
    process.env.BETTER_AUTH_URL ?? "https://cvr-mate.dk";
  const isLocal =
    baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

  if (isLocal) {
    // Direct send — QStash cannot reach localhost
    try {
      await sendNotificationEmail(payload);
    } catch (err) {
      console.error("[email/dispatch] Direct send failed:", err);
    }
  } else {
    // Production: async via QStash (retries handled by the queue)
    const { queueNotificationEmail } = await import("./queue");
    await queueNotificationEmail(payload);
  }
}
