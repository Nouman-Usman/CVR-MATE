import { NextResponse } from "next/server";
import { eq, and, ne, or, isNotNull, asc, desc, count } from "drizzle-orm";
import { db } from "@/db";
import { subscription, user } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/require-admin";
import { monthlyRevenueForSubscription, type PlanId } from "@/lib/stripe/plans";

/**
 * GET /api/admin/billing
 * Revenue snapshot derived from the subscription table (no amounts are stored,
 * so MRR is computed from plan + annual/monthly price detection).
 */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const [
      activeSubs, trials, dunning, pendingChurn, trialedTotal, trialedActive, statusCounts,
    ] = await Promise.all([
      db.select({ plan: subscription.plan, priceId: subscription.stripePriceId })
        .from(subscription)
        .where(and(eq(subscription.status, "active"), ne(subscription.plan, "free"))),

      db.select({
        userId: subscription.userId, email: user.email, name: user.name,
        plan: subscription.plan, trialStart: subscription.trialStart, trialEnd: subscription.trialEnd,
        stripeCustomerId: subscription.stripeCustomerId,
      })
        .from(subscription).innerJoin(user, eq(subscription.userId, user.id))
        .where(eq(subscription.status, "trialing")).orderBy(asc(subscription.trialEnd)),

      db.select({
        userId: subscription.userId, email: user.email, plan: subscription.plan,
        status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd,
        stripeCustomerId: subscription.stripeCustomerId, stripeSubscriptionId: subscription.stripeSubscriptionId,
      })
        .from(subscription).innerJoin(user, eq(subscription.userId, user.id))
        .where(or(eq(subscription.status, "past_due"), eq(subscription.status, "unpaid")))
        .orderBy(desc(subscription.currentPeriodEnd)),

      db.select({
        userId: subscription.userId, email: user.email, plan: subscription.plan,
        currentPeriodEnd: subscription.currentPeriodEnd, pendingPlanChange: subscription.pendingPlanChange,
        stripeCustomerId: subscription.stripeCustomerId, stripeSubscriptionId: subscription.stripeSubscriptionId,
      })
        .from(subscription).innerJoin(user, eq(subscription.userId, user.id))
        .where(and(eq(subscription.status, "active"), eq(subscription.cancelAtPeriodEnd, true)))
        .orderBy(asc(subscription.currentPeriodEnd)),

      db.select({ value: count() }).from(subscription)
        .where(isNotNull(subscription.trialStart)).then((r) => r[0]?.value ?? 0),

      db.select({ value: count() }).from(subscription)
        .where(and(isNotNull(subscription.trialStart), eq(subscription.status, "active")))
        .then((r) => r[0]?.value ?? 0),

      db.select({ status: subscription.status, total: count() })
        .from(subscription).groupBy(subscription.status),
    ]);

    // MRR + per-tier breakdown.
    const mrrByTier: Record<string, number> = {};
    const countByTier: Record<string, number> = {};
    let mrr = 0;
    for (const s of activeSubs) {
      const rev = monthlyRevenueForSubscription(s.plan, s.priceId);
      mrr += rev;
      mrrByTier[s.plan] = (mrrByTier[s.plan] ?? 0) + rev;
      countByTier[s.plan] = (countByTier[s.plan] ?? 0) + 1;
    }
    const paidCount = activeSubs.length;
    const arpu = paidCount > 0 ? Math.round(mrr / paidCount) : 0;
    const conversionRate = trialedTotal > 0 ? trialedActive / trialedTotal : 0;

    const now = Date.now();
    const withDaysLeft = trials.map((t) => ({
      ...t,
      daysLeft: t.trialEnd ? Math.ceil((new Date(t.trialEnd).getTime() - now) / 86400_000) : null,
    }));

    const tiers: PlanId[] = ["starter", "professional", "enterprise"];

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: {
        mrr, arr: mrr * 12, currency: "DKK", paidCount, arpu,
        trialCount: trials.length, conversionRate,
        pastDueCount: dunning.length, pendingChurnCount: pendingChurn.length,
      },
      mrrByTier: tiers.map((t) => ({ plan: t, mrr: mrrByTier[t] ?? 0, count: countByTier[t] ?? 0 })),
      statusDistribution: statusCounts,
      trials: withDaysLeft,
      dunning,
      pendingChurn,
    });
  } catch (error) {
    console.error("Admin billing failed:", error);
    return NextResponse.json({ error: "Failed to load billing" }, { status: 500 });
  }
}
