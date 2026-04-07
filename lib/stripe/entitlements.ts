import "server-only";

import { db } from "@/db";
import { subscription, usageRecord } from "@/db/schema";
import { eq, and, gte, count } from "drizzle-orm";
import { PLAN_LIMITS, resolvePlanId, priceToPlan, type PlanId, type PlanLimits } from "./plans";

export interface UserPlan {
  plan: PlanId;
  status: string;
  subscription: typeof subscription.$inferSelect | null;
}

export type MonthlyFeature =
  | "ai_usage"
  | "company_search"
  | "export"
  | "enrichment"
  | "email_draft"
  | "linkedin_draft"
  | "phone_draft"
  | "ai_task_suggest"
  | "bulk_push";

const FEATURE_TO_LIMIT: Record<MonthlyFeature, keyof PlanLimits> = {
  ai_usage: "aiUsagesPerMonth",
  company_search: "companySearchesPerMonth",
  export: "exportsPerMonth",
  enrichment: "enrichmentsPerMonth",
  email_draft: "emailDraftsPerMonth",
  linkedin_draft: "linkedinDraftsPerMonth",
  phone_draft: "phoneDraftsPerMonth",
  ai_task_suggest: "aiTaskSuggestPerMonth",
  bulk_push: "bulkPushPerMonth",
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

  // Derive plan from stripe_price_id as the source of truth (plan column may be stale)
  let plan = resolvePlanId(sub.plan);
  if (sub.stripePriceId && sub.status === "active") {
    const priceBasedPlan = priceToPlan(sub.stripePriceId);
    if (priceBasedPlan !== "free") {
      plan = priceBasedPlan;
    }
  }

  return {
    plan,
    status: sub.status,
    subscription: sub,
  };
}

export function getPlanLimits(plan: PlanId): PlanLimits {
  return PLAN_LIMITS[plan];
}

/**
 * Legacy feature name mapping — old boolean features now map to numeric limits.
 * "aiFeatures" → check if aiUsagesPerMonth > 0
 * "crm" → check if crmConnections > 0
 * "exports" → check if exportsPerMonth > 0
 */
const LEGACY_FEATURE_MAP: Record<string, keyof PlanLimits> = {
  aiFeatures: "aiUsagesPerMonth",
  crm: "crmConnections",
  exports: "exportsPerMonth",
};

/**
 * Check if a user has access to a feature (boolean or numeric > 0).
 * Supports legacy feature names (aiFeatures, crm, exports) for backward compat.
 */
export async function checkEntitlement(
  userId: string,
  feature: keyof PlanLimits | "aiFeatures" | "crm" | "exports"
): Promise<{ allowed: boolean; plan: PlanId }> {
  const { plan } = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  const resolvedKey = LEGACY_FEATURE_MAP[feature] ?? feature;
  const value = limits[resolvedKey as keyof PlanLimits];
  return {
    allowed: typeof value === "boolean" ? value : (value as number) > 0,
    plan,
  };
}

/**
 * Check if a user can add one more of a counted resource (saved companies, triggers).
 */
export async function checkUsageEntitlement(
  userId: string,
  feature: "savedCompanies" | "triggers" | "followedPeople" | "tasks" | "crmConnections",
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
export async function getUsageSummary(userId: string): Promise<
  Record<string, { used: number; limit: number }>
> {
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
    enrichments: {
      used: usageMap["enrichment"] ?? 0,
      limit: serializeLimit(limits.enrichmentsPerMonth),
    },
    emailDrafts: {
      used: usageMap["email_draft"] ?? 0,
      limit: serializeLimit(limits.emailDraftsPerMonth),
    },
    linkedinDrafts: {
      used: usageMap["linkedin_draft"] ?? 0,
      limit: serializeLimit(limits.linkedinDraftsPerMonth),
    },
    phoneDrafts: {
      used: usageMap["phone_draft"] ?? 0,
      limit: serializeLimit(limits.phoneDraftsPerMonth),
    },
    aiTaskSuggestions: {
      used: usageMap["ai_task_suggest"] ?? 0,
      limit: serializeLimit(limits.aiTaskSuggestPerMonth),
    },
    bulkPush: {
      used: usageMap["bulk_push"] ?? 0,
      limit: serializeLimit(limits.bulkPushPerMonth),
    },
  };
}
