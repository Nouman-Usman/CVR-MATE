import "server-only";

import { db } from "@/db";
import { orgAuditLog } from "@/db/app-schema";

export type AuditAction =
  | "org_created"
  | "org_renamed"
  | "org_deleted"
  | "member_invited"
  | "invitation_accepted"
  | "invitation_declined"
  | "invite_revoked"
  | "member_removed"
  | "member_left"
  | "role_changed"
  | "ownership_transferred"
  | "seat_limit_reached"
  | "permission_denied";

interface LogOrgEventParams {
  organizationId: string;
  actorId: string | null;
  action: AuditAction;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Write a row to org_audit_log. Fire-and-forget safe — errors are logged
 * but never thrown to avoid disrupting the primary operation.
 */
export async function logOrgEvent({
  organizationId,
  actorId,
  action,
  targetUserId,
  metadata,
}: LogOrgEventParams): Promise<void> {
  try {
    await db.insert(orgAuditLog).values({
      organizationId,
      actorId,
      action,
      targetUserId: targetUserId ?? null,
      metadata: metadata ?? {},
    });
  } catch (err) {
    console.error("[team/audit] Failed to log event:", action, err);
  }
}
