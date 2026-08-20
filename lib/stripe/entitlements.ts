import "server-only";

import { db } from "@/db";
import { subscription, usageRecord, leadTrigger } from "@/db/schema";
import { member } from "@/db/auth-schema";
import { eq, and, gte, count, isNull, sql, type SQL } from "drizzle-orm";
import { workspaceKey, type Workspace } from "@/lib/workspace/types";
import { PLAN_LIMITS, priceToPlan, type PlanId, type PlanLimits } from "./plans";

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

/** Grace period for past_due status before downgrading to free (3 days) */
const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Get the user's current plan. No subscription row = Free.
 *
 * Source of truth: `stripePriceId` — the plan column is a cached derivation
 * written by the webhook and should never be trusted independently.
 *
 * Status handling:
 * - active        → paid plan from stripePriceId
 * - past_due      → paid plan for 3-day grace period, then free
 * - canceled      → free
 * - unpaid        → free
 * - incomplete    → free
 */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
  });

  if (!sub) {
    return { plan: "free", status: "active", subscription: null };
  }

  // These statuses = no access
  if (sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete") {
    return { plan: "free", status: sub.status, subscription: sub };
  }

  // Derive plan exclusively from stripePriceId (single source of truth)
  const plan = sub.stripePriceId ? priceToPlan(sub.stripePriceId) : "free";

  // past_due: grant a 3-day grace period, then downgrade
  if (sub.status === "past_due") {
    const pastDueSince = sub.updatedAt ?? sub.createdAt;
    const graceExpired = Date.now() - pastDueSince.getTime() > PAST_DUE_GRACE_MS;

    if (graceExpired) {
      return { plan: "free", status: "past_due", subscription: sub };
    }
    // Within grace period — keep their paid plan
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
  feature:
    | "savedCompanies"
    | "triggers"
    | "followedPeople"
    | "followedCompanies"
    | "tasks"
    | "crmConnections",
  currentCount: number,
  workspace: Workspace = personalWorkspace(userId)
): Promise<{ allowed: boolean; plan: PlanId; limit: number; current: number }> {
  // The caller supplies `currentCount`, so it must count the same workspace
  // whose limit is being applied — a personal count against an org's limit
  // would silently grant everyone the owner's allowance each.
  const { plan } = await getUserPlan(await billingUserFor(workspace));
  const limits = getPlanLimits(plan);
  const limit = limits[feature];
  return {
    allowed: currentCount < limit,
    plan,
    limit,
    current: currentCount,
  };
}

// ─── Workspace attribution ──────────────────────────────────────────────────

/**
 * Metering follows the workspace the work was done in.
 *
 * Two separate questions used to share one column. `usage_record.userId`
 * answered *who did this*, and was also used as *whose allowance this spends* —
 * fine until organizations existed. After that, a member drafting a follow-up
 * for their team drew down their own personal quota, so someone on Pro could
 * exhaust their month doing an Enterprise org's work while the org's unlimited
 * plan sat unused.
 *
 * Omitting the workspace means personal, which is exactly the previous
 * behaviour — so a call site that has not been migrated still charges the
 * individual rather than silently handing out an organization's allowance.
 */
function personalWorkspace(userId: string): Workspace {
  return { type: "personal", userId };
}

/** Whose subscription sets the limit for this workspace. */
export async function billingUserFor(workspace: Workspace): Promise<string> {
  if (workspace.type === "personal") return workspace.userId;

  const owner = await db.query.member.findFirst({
    where: and(eq(member.organizationId, workspace.id), eq(member.role, "owner")),
    columns: { userId: true },
  });
  // An organization with no owner cannot reach a metered route — every one is
  // behind assertOrgPlanActive, which rejects first. Falling back to the actor
  // keeps this total rather than throwing from inside a quota check.
  return owner?.userId ?? workspace.userId;
}

/** Which rows count toward this workspace's usage. */
function usageScope(workspace: Workspace): SQL {
  return workspace.type === "org"
    ? (eq(usageRecord.organizationId, workspace.id) as SQL)
    : (and(
        eq(usageRecord.userId, workspace.userId),
        isNull(usageRecord.organizationId)
      ) as SQL);
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
  feature: MonthlyFeature,
  workspace: Workspace = personalWorkspace(userId)
): Promise<{ allowed: boolean; plan: PlanId; limit: number; used: number }> {
  const { plan, subscription: sub } = await getUserPlan(await billingUserFor(workspace));
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
        usageScope(workspace),
        eq(usageRecord.feature, feature),
        gte(usageRecord.createdAt, periodStart)
      )
    );

  const used = rows[0]?.value ?? 0;
  return { allowed: used < limit, plan, limit, used };
}

/**
 * Atomically reserve one monthly quota unit before expensive work starts.
 *
 * The advisory transaction lock serializes reservations per user+feature, so
 * concurrent requests cannot all observe the same pre-insert usage count.
 */
export async function reserveMonthlyQuota(
  userId: string,
  feature: MonthlyFeature,
  workspace: Workspace = personalWorkspace(userId)
): Promise<{ allowed: boolean; plan: PlanId; limit: number; used: number }> {
  return db.transaction(async (tx) => {
    /**
     * The lock is keyed on the bucket being spent, not on the person spending.
     *
     * Keyed by user, two members of the same organization reserving at once
     * would take different locks, both read the same pre-insert count, and both
     * pass — which is precisely the race this lock exists to prevent, reappearing
     * as soon as a quota became shared.
     */
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${workspaceKey(workspace)}:${feature}`}))`
    );

    const { plan, subscription: sub } = await getUserPlan(await billingUserFor(workspace));
    const limits = getPlanLimits(plan);
    const limitKey = FEATURE_TO_LIMIT[feature];
    const limit = limits[limitKey] as number;

    if (limit === 0) return { allowed: false, plan, limit: 0, used: 0 };

    const periodStart = sub?.currentPeriodStart ?? startOfCurrentMonth();

    // `userId` is always the actor, so the audit answer stays intact even when
    // the cost lands on an organization.
    const row = {
      userId,
      organizationId: workspace.type === "org" ? workspace.id : null,
      feature,
    };

    if (!isFinite(limit)) {
      await tx.insert(usageRecord).values(row);
      return { allowed: true, plan, limit: -1, used: 0 };
    }

    const rows = await tx
      .select({ value: count() })
      .from(usageRecord)
      .where(
        and(
          usageScope(workspace),
          eq(usageRecord.feature, feature),
          gte(usageRecord.createdAt, periodStart)
        )
      );

    const used = rows[0]?.value ?? 0;
    if (used >= limit) return { allowed: false, plan, limit, used };

    await tx.insert(usageRecord).values(row);
    return { allowed: true, plan, limit, used };
  });
}

/**
 * Record a usage event for monthly quota tracking.
 */
export async function recordUsage(
  userId: string,
  feature: MonthlyFeature,
  workspace: Workspace = personalWorkspace(userId)
): Promise<void> {
  await db.insert(usageRecord).values({
    userId,
    organizationId: workspace.type === "org" ? workspace.id : null,
    feature,
  });
}

/**
 * Get a summary of all monthly quotas for a user (used by the subscription API).
 */
export async function getUsageSummary(
  userId: string,
  workspace: Workspace = personalWorkspace(userId)
): Promise<Record<string, { used: number; limit: number }>> {
  const { plan, subscription: sub } = await getUserPlan(await billingUserFor(workspace));
  const limits = getPlanLimits(plan);
  const periodStart = sub?.currentPeriodStart ?? startOfCurrentMonth();

  const rows = await db
    .select({
      feature: usageRecord.feature,
      value: count(),
    })
    .from(usageRecord)
    .where(and(usageScope(workspace), gte(usageRecord.createdAt, periodStart)))
    .groupBy(usageRecord.feature);

  const usageMap: Record<string, number> = {};
  for (const row of rows) {
    usageMap[row.feature] = row.value;
  }

  const [{ value: activeTriggerCount }] = await db
    .select({ value: count() })
    .from(leadTrigger)
    .where(
      and(
        eq(leadTrigger.userId, userId),
        isNull(leadTrigger.organizationId),
        eq(leadTrigger.isActive, true)
      )
    );

  const serializeLimit = (v: number) => (isFinite(v) ? v : -1);

  return {
    activeTriggers: {
      used: activeTriggerCount,
      limit: serializeLimit(limits.triggers),
    },
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
