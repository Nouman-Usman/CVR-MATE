import "server-only";

import { db } from "@/db";
import { activity } from "@/db/schema";

/**
 * Unified activity/timeline logging. Writes to the `activity` table, which
 * powers per-company feeds and the audit trail.
 *
 * IMPORTANT: `entityId` is the child entity's own id (contact id, deal id, …),
 * NOT the company id. To make a per-company feed a single indexed filter rather
 * than N joins, ALWAYS pass `companyId` in `metadata` when the entity belongs
 * to a company. Feed queries then use `metadata->>'companyId'`.
 */

export type ActivityEntityType =
  | "company"
  | "todo"
  | "note"
  | "contact"
  | "interaction"
  | "contract"
  | "segment"
  | "product"
  | "quote"
  | "order"
  | "deal"
  | "pipeline"
  | "stage"
  | "trigger"
  | "crm_sync";

export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "synced"
  | "exported"
  | "saved"
  | "unsaved"
  | "stage_changed"
  | "won"
  | "lost";

export interface LogActivityParams {
  userId: string;
  organizationId: string | null;
  entityType: ActivityEntityType;
  entityId: string | null;
  action: ActivityAction;
  /** Free-form context. Include `companyId` whenever the entity is company-scoped. */
  metadata?: Record<string, unknown>;
}

/**
 * Insert an activity row. Fire-and-forget safe: failures are logged but never
 * thrown, so activity logging can never break the primary operation.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await db.insert(activity).values({
      userId: params.userId,
      organizationId: params.organizationId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.error("[activity/log] Failed to log activity:", params.action, err);
  }
}
