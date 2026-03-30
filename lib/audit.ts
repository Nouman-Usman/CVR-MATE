import "server-only";

import { headers } from "next/headers";
import { db } from "@/db";
import { activity } from "@/db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export type AuditEntityType =
  | "company"
  | "todo"
  | "note"
  | "trigger"
  | "crm_sync"
  | "member"
  | "organization"
  | "billing"
  | "api_key"
  | "sso"
  | "permission"
  | "export";

export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "synced"
  | "exported"
  | "saved"
  | "unsaved"
  | "invited"
  | "removed"
  | "role_changed"
  | "login"
  | "logout"
  | "api_key_created"
  | "api_key_revoked"
  | "settings_changed";

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditLogEntry {
  userId: string;
  organizationId?: string | null;
  entityType: AuditEntityType;
  entityId?: string;
  action: AuditAction;
  resource?: string; // mirrors permission resources for filtering
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
}

// ─── Helper to extract request context ──────────────────────────────────────

async function getRequestContext(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  try {
    const hdrs = await headers();
    const ipAddress =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      hdrs.get("x-real-ip") ??
      null;
    const userAgent = hdrs.get("user-agent") ?? null;
    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

// ─── Main audit logging function ────────────────────────────────────────────

/**
 * Log an activity to the audit trail with IP, user agent, and severity.
 * Non-blocking — errors are swallowed to avoid disrupting the request.
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const { ipAddress, userAgent } = await getRequestContext();

    await db.insert(activity).values({
      userId: entry.userId,
      organizationId: entry.organizationId ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId as any, // uuid or undefined
      action: entry.action,
      resource: entry.resource,
      severity: entry.severity ?? "info",
      ipAddress,
      userAgent,
      metadata: entry.metadata ?? {},
    });
  } catch (error) {
    // Non-blocking — log to console but don't throw
    console.error("[audit] Failed to log activity:", error);
  }
}

// ─── Convenience helpers for common audit events ────────────────────────────

export async function logMemberInvited(
  userId: string,
  orgId: string,
  invitedEmail: string,
  role: string
): Promise<void> {
  await logAudit({
    userId,
    organizationId: orgId,
    entityType: "member",
    action: "invited",
    resource: "members",
    metadata: { invitedEmail, role },
  });
}

export async function logMemberRemoved(
  userId: string,
  orgId: string,
  removedUserId: string
): Promise<void> {
  await logAudit({
    userId,
    organizationId: orgId,
    entityType: "member",
    action: "removed",
    resource: "members",
    severity: "warning",
    metadata: { removedUserId },
  });
}

export async function logRoleChanged(
  userId: string,
  orgId: string,
  targetUserId: string,
  oldRole: string,
  newRole: string
): Promise<void> {
  await logAudit({
    userId,
    organizationId: orgId,
    entityType: "member",
    action: "role_changed",
    resource: "members",
    severity: "warning",
    metadata: { targetUserId, oldRole, newRole },
  });
}

export async function logSettingsChanged(
  userId: string,
  orgId: string,
  changedFields: string[]
): Promise<void> {
  await logAudit({
    userId,
    organizationId: orgId,
    entityType: "organization",
    action: "settings_changed",
    resource: "settings",
    metadata: { changedFields },
  });
}

export async function logApiKeyCreated(
  userId: string,
  orgId: string,
  keyPrefix: string,
  keyName: string
): Promise<void> {
  await logAudit({
    userId,
    organizationId: orgId,
    entityType: "api_key",
    action: "api_key_created",
    resource: "api_keys",
    metadata: { keyPrefix, keyName },
  });
}

export async function logApiKeyRevoked(
  userId: string,
  orgId: string,
  keyPrefix: string
): Promise<void> {
  await logAudit({
    userId,
    organizationId: orgId,
    entityType: "api_key",
    action: "api_key_revoked",
    resource: "api_keys",
    severity: "warning",
    metadata: { keyPrefix },
  });
}
