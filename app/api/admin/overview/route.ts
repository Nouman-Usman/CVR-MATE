import { NextResponse } from "next/server";
import { eq, and, count, gte, ne, desc, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { subscription, activity, leadTrigger, usageRecord, user } from "@/db/schema";
import { verifyAdminToken } from "@/lib/admin/auth";
import { cacheGet, cacheSet } from "@/lib/redis";
import { CACHE_TTL, cacheKey } from "@/lib/cache";

export async function GET() {
  try {
    const adminCookie = (await cookies()).get("admin-session")?.value;
    const adminEmail = await verifyAdminToken(adminCookie);
    if (!adminEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const key = cacheKey.adminOverview();
    const cached = await cacheGet(key);
    if (cached) return NextResponse.json(cached);

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      newToday,
      activeTriggers,
      paidSubCount,
      planCounts,
      statusCounts,
      recentUsers,
      recentActivity,
      featureUsage,
      userTrend7d,
      subTrend30d,
    ] = await Promise.all([
      db.select({ value: count() }).from(user)
        .then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(user)
        .where(gte(user.createdAt, todayStart))
        .then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(leadTrigger)
        .where(eq(leadTrigger.isActive, true))
        .then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(subscription)
        .where(and(ne(subscription.plan, "free"), eq(subscription.status, "active")))
        .then((r) => r[0]?.value ?? 0),

      db.select({ plan: subscription.plan, total: count() })
        .from(subscription)
        .groupBy(subscription.plan),

      db.select({ status: subscription.status, total: count() })
        .from(subscription)
        .groupBy(subscription.status),

      db.select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        plan: subscription.plan,
      })
        .from(user)
        .leftJoin(subscription, eq(subscription.userId, user.id))
        .orderBy(desc(user.createdAt))
        .limit(10),

      db.select({
        id: activity.id,
        entityType: activity.entityType,
        action: activity.action,
        createdAt: activity.createdAt,
      })
        .from(activity)
        .orderBy(desc(activity.createdAt))
        .limit(20),

      db.select({ feature: usageRecord.feature, total: count() })
        .from(usageRecord)
        .where(gte(usageRecord.createdAt, monthStart))
        .groupBy(usageRecord.feature)
        .orderBy(desc(count())),

      // 7-day user registration trend (grouped by day)
      db.select({
        day: sql<string>`date_trunc('day', ${user.createdAt})::date`,
        total: count(),
      })
        .from(user)
        .where(gte(user.createdAt, sevenDaysAgo))
        .groupBy(sql`date_trunc('day', ${user.createdAt})`),

      // 30-day subscription creation trend
      db.select({
        day: sql<string>`date_trunc('day', ${subscription.createdAt})::date`,
        total: count(),
      })
        .from(subscription)
        .where(gte(subscription.createdAt, thirtyDaysAgo))
        .groupBy(sql`date_trunc('day', ${subscription.createdAt})`),
    ]);

    // Normalise 7-day user trend to fill missing days with 0
    const userTrendMap = new Map(userTrend7d.map((r) => [r.day, Number(r.total)]));
    const normalised7dUser = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key7 = d.toISOString().split("T")[0];
      return {
        day: key7,
        label: d.toLocaleDateString("en", { weekday: "short" }),
        users: userTrendMap.get(key7) ?? 0,
      };
    });

    // Normalise 30-day subscription trend
    const subTrendMap = new Map(subTrend30d.map((r) => [r.day, Number(r.total)]));
    const normalised30dSub = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const key30 = d.toISOString().split("T")[0];
      return {
        day: key30,
        label: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
        subscriptions: subTrendMap.get(key30) ?? 0,
      };
    });

    const data = {
      generatedAt: now.toISOString(),
      kpis: { totalUsers, newToday, paidSubscriptions: paidSubCount, activeTriggers },
      planDistribution: planCounts,
      statusDistribution: statusCounts,
      recentUsers,
      recentActivity,
      featureUsage,
      userTrend: normalised7dUser,
      subTrend: normalised30dSub,
    };

    await cacheSet(key, data, CACHE_TTL.adminOverview);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Admin overview failed:", error);
    return NextResponse.json({ error: "Failed to load overview" }, { status: 500 });
  }
}
