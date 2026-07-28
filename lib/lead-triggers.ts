import "server-only";

import { and, eq, count, isNull } from "drizzle-orm";
import { db } from "@/db";
import { leadTrigger } from "@/db/schema";
import { computeNextRun, buildCronExpression } from "@/lib/cron";

/**
 * Persistence for lead triggers. Holds ONLY the DB-write logic that the POST
 * handler of `app/api/triggers/route.ts` previously ran inline (schedule
 * derivation + insert). Auth, org scope, and entitlement stay in the callers.
 */

export interface CreateLeadTriggerInput {
  name: string;
  filters?: unknown;
  frequency?: string;
  notificationChannels?: string[];
  scheduledHour?: number;
  scheduledMinute?: number;
  scheduledDayOfWeek?: number | null;
  timezone?: string;
}

/** Count of a user's active personal triggers — mirrors the route's count. */
export async function countActiveTriggers(userId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(leadTrigger)
    .where(
      and(
        eq(leadTrigger.userId, userId),
        isNull(leadTrigger.organizationId),
        eq(leadTrigger.isActive, true)
      )
    );
  return value;
}

/**
 * Create a lead trigger in the given scope (personal when `organizationId` is
 * null), deriving the cron expression and next-run time from the schedule.
 */
export async function createLeadTrigger(
  userId: string,
  organizationId: string | null,
  input: CreateLeadTriggerInput
) {
  const freq = input.frequency ?? "daily";
  const hour = input.scheduledHour ?? 8;
  const minute = input.scheduledMinute ?? 0;
  const dow = freq === "weekly" ? (input.scheduledDayOfWeek ?? 1) : null; // default Monday
  const tz = input.timezone ?? "Europe/Copenhagen";

  const cronExpr = buildCronExpression(freq, hour, minute, dow);
  const nextRunAt = computeNextRun(freq, hour, minute, dow, tz);

  const [newTrigger] = await db
    .insert(leadTrigger)
    .values({
      userId,
      organizationId,
      name: input.name.trim(),
      filters: (input.filters ?? {}) as Record<string, unknown>,
      frequency: freq,
      notificationChannels: input.notificationChannels ?? ["in_app"],
      scheduledHour: hour,
      scheduledMinute: minute,
      scheduledDayOfWeek: dow,
      timezone: tz,
      cronExpression: cronExpr,
      nextRunAt,
    })
    .returning();

  return newTrigger;
}
