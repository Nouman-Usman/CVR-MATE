import { NextRequest, NextResponse } from "next/server";
import {
  eq, and, or, ne, count, countDistinct, gte, lt, isNotNull, desc, sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  subscription, activity, leadTrigger, usageRecord, user, session,
  crmSyncLog, emailLog, changeFeedCursor,
} from "@/db/schema";
import { requireAdmin } from "@/lib/admin/require-admin";
import { monthlyRevenueForSubscription } from "@/lib/stripe/plans";
import { cacheGet, cacheSet } from "@/lib/redis";
import { CACHE_TTL, cacheKey } from "@/lib/cache";

// Trend window options for the registration/subscription charts.
const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const rangeParam = req.nextUrl.searchParams.get("range") ?? "30d";
    const range = rangeParam in RANGE_DAYS ? rangeParam : "30d";
    const rangeDays = RANGE_DAYS[range];

    const key = cacheKey.adminOverview(range);
    const cached = await cacheGet(key);
    if (cached) return NextResponse.json(cached);

    const now = new Date();
    const todayStart = new Date(now); todayStart.setUTCHours(0, 0, 0, 0);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const staleLockCutoff = new Date(now.getTime() - 30 * 60 * 1000); // 30 min
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fixed windows for period-over-period deltas (independent of the chart range).
    const day = 24 * 60 * 60 * 1000;
    const sevenAgo = new Date(now.getTime() - 7 * day);
    const fourteenAgo = new Date(now.getTime() - 14 * day);
    const thirtyAgo = new Date(now.getTime() - 30 * day);
    const sixtyAgo = new Date(now.getTime() - 60 * day);

    // Chart range start, aligned to UTC midnight so day buckets line up.
    const rangeStart = new Date(now);
    rangeStart.setDate(rangeStart.getDate() - (rangeDays - 1));
    rangeStart.setUTCHours(0, 0, 0, 0);

    const [
      totalUsers,
      newToday,
      signups7d,
      signupsPrev7d,
      activeTriggers,
      paidSubs,
      trials,
      subs30d,
      subsPrev30d,
      dau,
      syncErrors24h,
      planCounts,
      statusCounts,
      recentUsers,
      recentActivity,
      featureUsage,
      userTrendRows,
      subTrendRows,
      overdueTriggers,
      pastDueSubs,
      staleLocks,
      emailSent30d,
      emailBounced30d,
    ] = await Promise.all([
      db.select({ value: count() }).from(user).then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(user)
        .where(gte(user.createdAt, todayStart)).then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(user)
        .where(gte(user.createdAt, sevenAgo)).then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(user)
        .where(and(gte(user.createdAt, fourteenAgo), lt(user.createdAt, sevenAgo)))
        .then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(leadTrigger)
        .where(eq(leadTrigger.isActive, true)).then((r) => r[0]?.value ?? 0),

      // Active paid subs — rows carry plan + price so we derive MRR from the same fetch.
      db.select({ plan: subscription.plan, priceId: subscription.stripePriceId })
        .from(subscription)
        .where(and(ne(subscription.plan, "free"), eq(subscription.status, "active"))),

      db.select({ value: count() }).from(subscription)
        .where(eq(subscription.status, "trialing")).then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(subscription)
        .where(gte(subscription.createdAt, thirtyAgo)).then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(subscription)
        .where(and(gte(subscription.createdAt, sixtyAgo), lt(subscription.createdAt, thirtyAgo)))
        .then((r) => r[0]?.value ?? 0),

      // DAU proxy — distinct users whose session was touched since UTC midnight.
      db.select({ value: countDistinct(session.userId) }).from(session)
        .where(gte(session.updatedAt, todayStart)).then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(crmSyncLog)
        .where(and(eq(crmSyncLog.status, "error"), gte(crmSyncLog.createdAt, dayAgo)))
        .then((r) => r[0]?.value ?? 0),

      db.select({ plan: subscription.plan, total: count() })
        .from(subscription).groupBy(subscription.plan),

      db.select({ status: subscription.status, total: count() })
        .from(subscription).groupBy(subscription.status),

      db.select({
        id: user.id, name: user.name, email: user.email,
        emailVerified: user.emailVerified, createdAt: user.createdAt, plan: subscription.plan,
      })
        .from(user)
        .leftJoin(subscription, eq(subscription.userId, user.id))
        .orderBy(desc(user.createdAt)).limit(10),

      db.select({
        id: activity.id, entityType: activity.entityType,
        action: activity.action, createdAt: activity.createdAt,
      })
        .from(activity).orderBy(desc(activity.createdAt)).limit(20),

      db.select({ feature: usageRecord.feature, total: count() })
        .from(usageRecord).where(gte(usageRecord.createdAt, monthStart))
        .groupBy(usageRecord.feature).orderBy(desc(count())),

      db.select({
        day: sql<string>`date_trunc('day', ${user.createdAt})::date`,
        total: count(),
      })
        .from(user).where(gte(user.createdAt, rangeStart))
        .groupBy(sql`date_trunc('day', ${user.createdAt})`),

      db.select({
        day: sql<string>`date_trunc('day', ${subscription.createdAt})::date`,
        total: count(),
      })
        .from(subscription).where(gte(subscription.createdAt, rangeStart))
        .groupBy(sql`date_trunc('day', ${subscription.createdAt})`),

      // ── Alert-banner conditions ──
      db.select({ value: count() }).from(leadTrigger)
        .where(and(eq(leadTrigger.isActive, true), isNotNull(leadTrigger.nextRunAt), lt(leadTrigger.nextRunAt, now)))
        .then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(subscription)
        .where(or(eq(subscription.status, "past_due"), eq(subscription.status, "unpaid")))
        .then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(changeFeedCursor)
        .where(and(eq(changeFeedCursor.isProcessing, true), lt(changeFeedCursor.processingStartedAt, staleLockCutoff)))
        .then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(emailLog)
        .where(and(gte(emailLog.createdAt, thirtyAgo), eq(emailLog.status, "sent")))
        .then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(emailLog)
        .where(and(gte(emailLog.createdAt, thirtyAgo), eq(emailLog.deliveryStatus, "bounced")))
        .then((r) => r[0]?.value ?? 0),
    ]);

    // ── Derived metrics ──
    const mrr = paidSubs.reduce((sum, s) => sum + monthlyRevenueForSubscription(s.plan, s.priceId), 0);
    const paidCount = paidSubs.length;
    const bounceRate = emailSent30d > 0 ? emailBounced30d / emailSent30d : 0;
    const pct = (curr: number, prev: number): number | null =>
      prev === 0 ? (curr > 0 ? 100 : null) : Math.round(((curr - prev) / prev) * 100);

    // ── Normalise trend series (fill gap days with 0) ──
    const buildTrend = (rows: { day: string; total: number }[], valueKey: string) => {
      const map = new Map(rows.map((r) => [r.day, Number(r.total)]));
      return Array.from({ length: rangeDays }).map((_, i) => {
        const d = new Date(rangeStart);
        d.setDate(d.getDate() + i);
        const k = d.toISOString().split("T")[0];
        return {
          day: k,
          label: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
          [valueKey]: map.get(k) ?? 0,
        };
      });
    };

    // ── Alerts ──
    const alerts: { level: "warn" | "danger"; label: string; href?: string }[] = [];
    if (overdueTriggers > 0)
      alerts.push({ level: "warn", label: `${overdueTriggers} trigger${overdueTriggers > 1 ? "s" : ""} overdue`, href: "/admin/health" });
    if (pastDueSubs > 0)
      alerts.push({ level: "danger", label: `${pastDueSubs} subscription${pastDueSubs > 1 ? "s" : ""} past due`, href: "/admin/billing" });
    if (staleLocks > 0)
      alerts.push({ level: "danger", label: `Change-feed lock stale (${staleLocks})`, href: "/admin/health" });
    if (emailSent30d >= 20 && bounceRate > 0.05)
      alerts.push({ level: "warn", label: `Email bounce rate ${(bounceRate * 100).toFixed(1)}%`, href: "/admin/email" });
    if (syncErrors24h > 0)
      alerts.push({ level: "warn", label: `${syncErrors24h} CRM sync error${syncErrors24h > 1 ? "s" : ""} (24h)`, href: "/admin/integrations" });

    const data = {
      generatedAt: now.toISOString(),
      range,
      kpis: {
        totalUsers: { value: totalUsers, deltaPct: pct(signups7d, signupsPrev7d), deltaLabel: "signups vs last week" },
        newToday: { value: newToday },
        dau: { value: dau },
        mrr: { value: mrr, currency: "DKK" },
        paidSubscriptions: { value: paidCount, deltaPct: pct(subs30d, subsPrev30d), deltaLabel: "new subs vs prior 30d" },
        trials: { value: trials },
        activeTriggers: { value: activeTriggers },
        syncErrors24h: { value: syncErrors24h },
      },
      alerts,
      planDistribution: planCounts,
      statusDistribution: statusCounts,
      recentUsers,
      recentActivity,
      featureUsage,
      userTrend: buildTrend(userTrendRows, "users"),
      subTrend: buildTrend(subTrendRows, "subscriptions"),
    };

    await cacheSet(key, data, CACHE_TTL.adminOverview);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Admin overview failed:", error);
    return NextResponse.json({ error: "Failed to load overview" }, { status: 500 });
  }
}
