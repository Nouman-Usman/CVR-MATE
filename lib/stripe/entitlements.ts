import "server-only";

import { db } from "@/db";
import { subscription, usageRecord, member } from "@/db/schema";
import { eq, and, gte, count } from "drizzle-orm";
import { PLAN_LIMITS, type PlanId, type PlanLimits } from "./plans";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OrgPlan {
  plan: PlanId;
  status: string;
  subscription: typeof subscription.$inferSelect | null;
}

/** @deprecated Use getOrgPlan instead */
export type UserPlan = OrgPlan;

export type MonthlyFeature = "ai_usage" | "company_search" | "export";

const FEATURE_TO_LIMIT: Record<MonthlyFeature, keyof PlanLimits> = {
  ai_usage: "aiUsagesPerMonth",
  company_search: "companySearchesPerMonth",
  export: "exportsPerMonth",
};

// ─── Org-scoped plan resolution ─────────────────────────────────────────────

/**
 * Get the organization's current plan. No subscription row = Free.
 * Canceled or unpaid subscriptions are treated as Free.
 */
export async function getOrgPlan(orgId: string): Promise<OrgPlan> {
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, orgId),
  });

  if (!sub) {
    return { plan: "free", status: "active", subscription: null };
  }

  if (sub.status === "canceled" || sub.status === "unpaid") {
    return { plan: "free", status: sub.status, subscription: sub };
  }

  return {
    plan: sub.plan as PlanId,
    status: sub.status,
    subscription: sub,
  };
}

/**
 * @deprecated Use getOrgPlan(orgId) instead. Kept for backward compatibility
 * during migration — resolves via the user's personal org subscription.
 */
export async function getUserPlan(userId: string): Promise<OrgPlan> {
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
  });

  if (!sub) {
    return { plan: "free", status: "active", subscription: null };
  }

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

// ─── Entitlement checks (org-scoped) ────────────────────────────────────────

/**
 * Check if an org has access to a boolean feature (e.g., aiFeatures, crm, sso).
 */
export async function checkEntitlement(
  orgId: string,
  feature: keyof PlanLimits
): Promise<{ allowed: boolean; plan: PlanId }> {
  const { plan } = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);
  const value = limits[feature];
  return {
    allowed: typeof value === "boolean" ? value : value > 0,
    plan,
  };
}

/**
 * Check if an org can add one more of a counted resource (saved companies, triggers).
 */
export async function checkUsageEntitlement(
  orgId: string,
  feature: "savedCompanies" | "triggers",
  currentCount: number
): Promise<{ allowed: boolean; plan: PlanId; limit: number; current: number }> {
  const { plan } = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);
  const limit = limits[feature];
  return {
    allowed: currentCount < limit,
    plan,
    limit,
    current: currentCount,
  };
}

// ─── Monthly Quota System (org-scoped) ──────────────────────────────────────

/** Start of the current calendar month (fallback for free orgs without a subscription). */
function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Check if an org has remaining monthly quota for a feature.
 * Quota is counted at the org level (all members' usage combined).
 */
export async function checkMonthlyQuota(
  orgId: string,
  feature: MonthlyFeature
): Promise<{ allowed: boolean; plan: PlanId; limit: number; used: number }> {
  const { plan, subscription: sub } = await getOrgPlan(orgId);
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
        eq(usageRecord.organizationId, orgId),
        eq(usageRecord.feature, feature),
        gte(usageRecord.createdAt, periodStart)
      )
    );

  const used = rows[0]?.value ?? 0;
  return { allowed: used < limit, plan, limit, used };
}

/**
 * Record a usage event for monthly quota tracking.
 * Tracks both org and individual user for analytics.
 */
export async function recordUsage(
  orgId: string,
  userId: string,
  feature: MonthlyFeature
): Promise<void> {
  await db.insert(usageRecord).values({ userId, organizationId: orgId, feature });
}

/**
 * Get a summary of all monthly quotas for an org.
 */
export async function getUsageSummary(orgId: string): Promise<{
  aiUsages: { used: number; limit: number };
  companySearches: { used: number; limit: number };
  exports: { used: number; limit: number };
}> {
  const { plan, subscription: sub } = await getOrgPlan(orgId);
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
        eq(usageRecord.organizationId, orgId),
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

// ─── Seat management ────────────────────────────────────────────────────────

/**
 * Check if an org can add another member based on their plan's seat limit.
 */
export async function checkSeatLimit(
  orgId: string
): Promise<{ allowed: boolean; plan: PlanId; maxSeats: number; currentSeats: number }> {
  const { plan } = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);

  const rows = await db
    .select({ value: count() })
    .from(member)
    .where(eq(member.organizationId, orgId));

  const currentSeats = rows[0]?.value ?? 0;

  return {
    allowed: currentSeats < limits.maxSeats,
    plan,
    maxSeats: isFinite(limits.maxSeats) ? limits.maxSeats : -1,
    currentSeats,
  };
}

/**
 * Get per-member usage breakdown for an org (admin analytics).
 */
export async function getMemberUsageSummary(
  orgId: string,
  periodStart?: Date
): Promise<Array<{ userId: string; feature: string; count: number }>> {
  const start = periodStart ?? startOfCurrentMonth();

  const rows = await db
    .select({
      userId: usageRecord.userId,
      feature: usageRecord.feature,
      value: count(),
    })
    .from(usageRecord)
    .where(
      and(
        eq(usageRecord.organizationId, orgId),
        gte(usageRecord.createdAt, start)
      )
    )
    .groupBy(usageRecord.userId, usageRecord.feature);

  return rows.map((r) => ({ userId: r.userId, feature: r.feature, count: r.value }));
}
