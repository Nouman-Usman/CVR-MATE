import "server-only";

import { db } from "@/db";
import { orgAuditLog } from "@/db/app-schema";

export type AuditAction =
  | "org_created"
  | "org_renamed"
  | "org_deleted"
  // The issuer identity printed on quotes and orders. Worth auditing: changing
  // it changes what customers see on documents that carry commercial weight.
  | "org_profile_updated"
  | "org_profile_verified"
  | "member_invited"
  | "invitation_accepted"
  | "invitation_declined"
  | "invite_revoked"
  | "member_removed"
  | "member_left"
  | "role_changed"
  | "ownership_transferred"
  // Ownership assigned by the system, not a person: an org whose owner's
  // account was deleted has nobody able to transfer it, so the cleanup sweep
  // promotes a successor. `actorId` is null on these.
  | "ownership_recovered"
  // Which bookkeeping agreement the org's invoices are issued through. Worth
  // auditing for the same reason as org_profile_updated: it changes where
  // commercially binding documents come from.
  | "accounting_connected"
  | "accounting_disconnected"
  | "seat_limit_reached"
  | "permission_denied"
  // Native CRM security-relevant events
  | "crm_contact_deleted"
  | "crm_deal_deleted"
  | "crm_data_exported";

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
