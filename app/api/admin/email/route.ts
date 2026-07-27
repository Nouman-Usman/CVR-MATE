import { NextResponse } from "next/server";
import { and, or, eq, gte, isNotNull, desc, count, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/require-admin";

/**
 * GET /api/admin/email
 * 30-day deliverability funnel from email_log (sent → delivered → bounced →
 * opened → clicked), bounce rate by template, and a recent-failure log.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const inWindow = gte(emailLog.createdAt, thirtyAgo);

    const [dispatched, sent, failed, delivered, bounced, opened, clicked, byTemplate, failures] = await Promise.all([
      db.select({ value: count() }).from(emailLog).where(inWindow).then((r) => r[0]?.value ?? 0),
      db.select({ value: count() }).from(emailLog).where(and(inWindow, eq(emailLog.status, "sent"))).then((r) => r[0]?.value ?? 0),
      db.select({ value: count() }).from(emailLog).where(and(inWindow, eq(emailLog.status, "failed"))).then((r) => r[0]?.value ?? 0),
      db.select({ value: count() }).from(emailLog).where(and(inWindow, eq(emailLog.deliveryStatus, "delivered"))).then((r) => r[0]?.value ?? 0),
      db.select({ value: count() }).from(emailLog).where(and(inWindow, eq(emailLog.deliveryStatus, "bounced"))).then((r) => r[0]?.value ?? 0),
      db.select({ value: count() }).from(emailLog).where(and(inWindow, isNotNull(emailLog.openedAt))).then((r) => r[0]?.value ?? 0),
      db.select({ value: count() }).from(emailLog).where(and(inWindow, isNotNull(emailLog.clickedAt))).then((r) => r[0]?.value ?? 0),

      db.select({
        templateId: emailLog.templateId,
        total: count(),
        bounced: sql<number>`sum(case when ${emailLog.deliveryStatus} = 'bounced' then 1 else 0 end)`,
        failed: sql<number>`sum(case when ${emailLog.status} = 'failed' then 1 else 0 end)`,
      })
        .from(emailLog).where(inWindow).groupBy(emailLog.templateId).orderBy(desc(count())).limit(20),

      db.select({
        id: emailLog.id, to: emailLog.to, subject: emailLog.subject, templateId: emailLog.templateId,
        status: emailLog.status, deliveryStatus: emailLog.deliveryStatus, error: emailLog.error, createdAt: emailLog.createdAt,
      })
        .from(emailLog)
        .where(and(inWindow, or(eq(emailLog.status, "failed"), eq(emailLog.deliveryStatus, "bounced"), eq(emailLog.deliveryStatus, "spam"))))
        .orderBy(desc(emailLog.createdAt)).limit(25),
    ]);

    const rate = (a: number, b: number) => (b > 0 ? a / b : 0);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: {
        dispatched, sent, failed, delivered, bounced, opened, clicked,
        bounceRate: rate(bounced, sent),
        deliveryRate: rate(delivered, sent),
        openRate: rate(opened, sent),
        clickRate: rate(clicked, opened),
        failureRate: rate(failed, dispatched),
      },
      byTemplate: byTemplate.map((t) => ({
        templateId: t.templateId ?? "(none)",
        total: Number(t.total), bounced: Number(t.bounced), failed: Number(t.failed),
      })),
      failures,
    });
  } catch (error) {
    console.error("Admin email failed:", error);
    return NextResponse.json({ error: "Failed to load email metrics" }, { status: 500 });
  }
}
