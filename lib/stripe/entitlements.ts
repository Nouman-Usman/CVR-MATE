import "server-only";

import { db } from "@/db";
import { subscription, usageRecord } from "@/db/schema";
import { eq, and, gte, count } from "drizzle-orm";
import { PLAN_LIMITS, type PlanId, type PlanLimits } from "./plans";

export interface UserPlan {
  plan: PlanId;
  status: string;
  subscription: typeof subscription.$inferSelect | null;
}

export type MonthlyFeature = "ai_usage" | "company_search" | "export";

const FEATURE_TO_LIMIT: Record<MonthlyFeature, keyof PlanLimits> = {
  ai_usage: "aiUsagesPerMonth",
  company_search: "companySearchesPerMonth",
  export: "exportsPerMonth",
};

/**
 * Get the user's current plan. No subscription row = Free.
 * Canceled or unpaid subscriptions are treated as Free.
 */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
  });

  if (!sub) {
    return { plan: "free", status: "active", subscription: null };
  }

  // Canceled or unpaid → downgraded to free
  if (sub.status === "canceled" || sub.status === "unpaid") {
    return { plan: "free", status: sub.status, subscription: sub };
  }

  return {
    plan: sub.plan as PlanId,
    status: sub.status,
    subscription: sub,
  };
}

export function getPlanLimits(plan: PlanId): PlanLimits {
  return PLAN_LIMITS[plan];
}

/**
 * Check if a user has access to a boolean feature (e.g., aiFeatures, crm, exports).
 */
export async function checkEntitlement(
  userId: string,
  feature: keyof PlanLimits
): Promise<{ allowed: boolean; plan: PlanId }> {
  const { plan } = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  const value = limits[feature];
  return {
    allowed: typeof value === "boolean" ? value : value > 0,
    plan,
  };
}

/**
 * Check if a user can add one more of a counted resource (saved companies, triggers).
 */
export async function checkUsageEntitlement(
  userId: string,
  feature: "savedCompanies" | "triggers",
  currentCount: number
): Promise<{ allowed: boolean; plan: PlanId; limit: number; current: number }> {
  const { plan } = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  const limit = limits[feature];
  return {
    allowed: currentCount < limit,
    plan,
    limit,
    current: currentCount,
  };
}

// ─── Monthly Quota System ───────────────────────────────────────────────────

/** Start of the current calendar month (fallback for free users without a subscription). */
function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Check if a user has remaining monthly quota for a feature.
 * Uses the subscription billing period as the window; falls back to calendar month for free users.
 */
export async function checkMonthlyQuota(
  userId: string,
  feature: MonthlyFeature
): Promise<{ allowed: boolean; plan: PlanId; limit: number; used: number }> {
  const { plan, subscription: sub } = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  const limitKey = FEATURE_TO_LIMIT[feature];
  const limit = limits[limitKey] as number;

  if (limit === 0) return { allowed: false, plan, limit: 0, used: 0 };
  if (!isFinite(limit)) return { allowed: true, plan, limit: -1, used: 0 };

  const periodStart = sub?.currentPeriodStart ?? startOfCurrentMonth();

  const rows = await db
    .select({ value: count() })
    .from(usageRecord)
    .where(
      and(
        eq(usageRecord.userId, userId),
        eq(usageRecord.feature, feature),
        gte(usageRecord.createdAt, periodStart)
      )
    );

  const used = rows[0]?.value ?? 0;
  return { allowed: used < limit, plan, limit, used };
}

/**
 * Record a usage event for monthly quota tracking.
 */
export async function recordUsage(
  userId: string,
  feature: MonthlyFeature
): Promise<void> {
  await db.insert(usageRecord).values({ userId, feature });
}

/**
 * Get a summary of all monthly quotas for a user (used by the subscription API).
 */
export async function getUsageSummary(userId: string): Promise<{
  aiUsages: { used: number; limit: number };
  companySearches: { used: number; limit: number };
  exports: { used: number; limit: number };
}> {
  const { plan, subscription: sub } = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  const periodStart = sub?.currentPeriodStart ?? startOfCurrentMonth();

  const rows = await db
    .select({
      feature: usageRecord.feature,
      value: count(),
    })
    .from(usageRecord)
    .where(
      and(
        eq(usageRecord.userId, userId),
        gte(usageRecord.createdAt, periodStart)
      )
    )
    .groupBy(usageRecord.feature);

  const usageMap: Record<string, number> = {};
  for (const row of rows) {
    usageMap[row.feature] = row.value;
  }

  const serializeLimit = (v: number) => (isFinite(v) ? v : -1);

  return {
    aiUsages: {
      used: usageMap["ai_usage"] ?? 0,
      limit: serializeLimit(limits.aiUsagesPerMonth),
    },
    companySearches: {
      used: usageMap["company_search"] ?? 0,
      limit: serializeLimit(limits.companySearchesPerMonth),
    },
    exports: {
      used: usageMap["export"] ?? 0,
      limit: serializeLimit(limits.exportsPerMonth),
    },
  };
}
