import { NextResponse } from "next/server";
import { isNotNull, desc, count, sql } from "drizzle-orm";
import { db } from "@/db";
import { chatLandingSession, enterpriseInquiry } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/require-admin";

/**
 * GET /api/admin/funnel
 * Chat-landing conversion funnel (created → signed up → converted) plus the
 * enterprise-inquiry inbox (previously had no UI at all).
 */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const [sessions, signups, converted, planDist, recentSessions, inquiries] = await Promise.all([
      db.select({ value: count() }).from(chatLandingSession).then((r) => r[0]?.value ?? 0),
      db.select({ value: count() }).from(chatLandingSession)
        .where(isNotNull(chatLandingSession.signupUserId)).then((r) => r[0]?.value ?? 0),
      db.select({ value: count() }).from(chatLandingSession)
        .where(isNotNull(chatLandingSession.convertedAt)).then((r) => r[0]?.value ?? 0),

      db.select({ plan: chatLandingSession.recommendedPlan, total: count() })
        .from(chatLandingSession)
        .where(isNotNull(chatLandingSession.recommendedPlan))
        .groupBy(chatLandingSession.recommendedPlan),

      db.select({
        id: chatLandingSession.id,
        createdAt: chatLandingSession.createdAt,
        recommendedPlan: chatLandingSession.recommendedPlan,
        signupEmail: chatLandingSession.signupEmail,
        convertedAt: chatLandingSession.convertedAt,
        ipAddress: chatLandingSession.ipAddress,
        transcript: chatLandingSession.transcript,
      })
        .from(chatLandingSession).orderBy(desc(chatLandingSession.createdAt)).limit(25),

      // Unhandled leads float to the top, then newest first.
      db.select().from(enterpriseInquiry)
        .orderBy(sql`${enterpriseInquiry.handledAt} ASC NULLS FIRST`, desc(enterpriseInquiry.createdAt))
        .limit(100),
    ]);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      funnel: {
        sessions, signups, converted,
        signupRate: sessions > 0 ? signups / sessions : 0,
        conversionRate: sessions > 0 ? converted / sessions : 0,
      },
      planDistribution: planDist,
      recentSessions,
      inquiries,
      openInquiries: inquiries.filter((i) => !i.handledAt).length,
    });
  } catch (error) {
    console.error("Admin funnel failed:", error);
    return NextResponse.json({ error: "Failed to load funnel" }, { status: 500 });
  }
}
