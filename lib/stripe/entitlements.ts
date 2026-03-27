import "server-only";

import { db } from "@/db";
import { subscription } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PLAN_LIMITS, type PlanId, type PlanLimits } from "./plans";

export interface UserPlan {
  plan: PlanId;
  status: string;
  subscription: typeof subscription.$inferSelect | null;
}

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
