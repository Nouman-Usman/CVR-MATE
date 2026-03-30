import "server-only";

import { db } from "@/db";
import { orgPermission, member } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { OrgRole } from "@/lib/auth-context";

// ─── Resource & Action types ────────────────────────────────────────────────

export type Resource =
  | "company"
  | "trigger"
  | "todo"
  | "note"
  | "crm"
  | "export"
  | "settings"
  | "billing"
  | "members"
  | "api_keys"
  | "audit_log";

export type Action = "create" | "read" | "update" | "delete" | "export";

// ─── Default permission matrix ──────────────────────────────────────────────
// Used when no org-specific overrides exist.
// Key: role -> resource -> allowed actions

const DEFAULT_PERMISSIONS: Record<OrgRole, Record<Resource, Action[]>> = {
  owner: {
    company: ["create", "read", "update", "delete", "export"],
    trigger: ["create", "read", "update", "delete"],
    todo: ["create", "read", "update", "delete"],
    note: ["create", "read", "update", "delete"],
    crm: ["create", "read", "update", "delete"],
    export: ["create", "read", "update", "delete"],
    settings: ["create", "read", "update", "delete"],
    billing: ["create", "read", "update", "delete"],
    members: ["create", "read", "update", "delete"],
    api_keys: ["create", "read", "update", "delete"],
    audit_log: ["read"],
  },
  admin: {
    company: ["create", "read", "update", "delete", "export"],
    trigger: ["create", "read", "update", "delete"],
    todo: ["create", "read", "update", "delete"],
    note: ["create", "read", "update", "delete"],
    crm: ["create", "read", "update", "delete"],
    export: ["create", "read", "update", "delete"],
    settings: ["create", "read", "update", "delete"],
    billing: ["read"],
    members: ["create", "read", "update"],
    api_keys: ["create", "read", "update", "delete"],
    audit_log: ["read"],
  },
  manager: {
    company: ["create", "read", "update", "delete", "export"],
    trigger: ["create", "read", "update", "delete"],
    todo: ["create", "read", "update", "delete"],
    note: ["create", "read", "update", "delete"],
    crm: ["create", "read", "update"],
    export: ["create", "read", "update", "delete"],
    settings: ["read"],
    billing: [],
    members: ["read"],
    api_keys: [],
    audit_log: ["read"],
  },
  member: {
    company: ["create", "read", "update", "delete"],
    trigger: ["create", "read", "update"],
    todo: ["create", "read", "update", "delete"], // scoped to own in API layer
    note: ["create", "read", "update", "delete"], // scoped to own in API layer
    crm: ["read"],
    export: ["read"],
    settings: ["read"],
    billing: [],
    members: ["read"],
    api_keys: [],
    audit_log: [],
  },
  viewer: {
    company: ["read"],
    trigger: ["read"],
    todo: ["read"],
    note: ["read"],
    crm: [],
    export: [],
    settings: ["read"],
    billing: [],
    members: ["read"],
    api_keys: [],
    audit_log: [],
  },
};

// ─── Permission checking ────────────────────────────────────────────────────

/**
 * Check if a user has permission to perform an action on a resource within an org.
 * First checks for org-specific overrides, then falls back to the default matrix.
 */
export async function checkPermission(
  userId: string,
  orgId: string,
  resource: string,
  action: string
): Promise<{ allowed: boolean; role: OrgRole }> {
  // Get user's role in this org
  const memberRow = await db.query.member.findFirst({
    where: and(eq(member.userId, userId), eq(member.organizationId, orgId)),
    columns: { role: true },
  });

  if (!memberRow) {
    return { allowed: false, role: "viewer" };
  }

  const role = memberRow.role as OrgRole;

  // Check org-specific permission override first
  const override = await db.query.orgPermission.findFirst({
    where: and(
      eq(orgPermission.organizationId, orgId),
      eq(orgPermission.role, role),
      eq(orgPermission.resource, resource)
    ),
    columns: { actions: true },
  });

  if (override) {
    const actions = override.actions as string[];
    return { allowed: actions.includes(action), role };
  }

  // Fall back to default permission matrix
  const defaultPerms = DEFAULT_PERMISSIONS[role];
  if (!defaultPerms) {
    return { allowed: false, role };
  }

  const resourcePerms = defaultPerms[resource as Resource];
  if (!resourcePerms) {
    return { allowed: false, role };
  }

  return { allowed: resourcePerms.includes(action as Action), role };
}

/**
 * Throws a 403 error if the user doesn't have the required permission.
 */
export async function requirePermission(
  userId: string,
  orgId: string,
  resource: string,
  action: string
): Promise<OrgRole> {
  const { allowed, role } = await checkPermission(userId, orgId, resource, action);
  if (!allowed) {
    const error = new Error(
      `Forbidden: role '${role}' cannot '${action}' on '${resource}'`
    );
    (error as any).status = 403;
    throw error;
  }
  return role;
}

/**
 * Get all permissions for a role within an org (with defaults as fallback).
 */
export async function getRolePermissions(
  orgId: string,
  role: OrgRole
): Promise<Record<string, string[]>> {
  // Get org-specific overrides
  const overrides = await db.query.orgPermission.findMany({
    where: and(
      eq(orgPermission.organizationId, orgId),
      eq(orgPermission.role, role)
    ),
    columns: { resource: true, actions: true },
  });

  // Start with defaults
  const result: Record<string, string[]> = {
    ...Object.fromEntries(
      Object.entries(DEFAULT_PERMISSIONS[role] || {}).map(([k, v]) => [k, [...v]])
    ),
  };

  // Apply overrides
  for (const override of overrides) {
    result[override.resource] = override.actions as string[];
  }

  return result;
}

/**
 * Seed default permissions for an organization.
 * Called when a new org is created.
 */
export async function seedOrgPermissions(orgId: string): Promise<void> {
  const rows: (typeof orgPermission.$inferInsert)[] = [];

  for (const [role, resources] of Object.entries(DEFAULT_PERMISSIONS)) {
    for (const [resource, actions] of Object.entries(resources)) {
      rows.push({
        organizationId: orgId,
        role,
        resource,
        actions,
      });
    }
  }

  if (rows.length > 0) {
    await db.insert(orgPermission).values(rows).onConflictDoNothing();
  }
}

/**
 * Check if a role is at least as powerful as the target role.
 * Used for "can this user change that user's role" checks.
 */
const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  member: 40,
  viewer: 20,
};

export function isRoleAtLeast(role: OrgRole, minimumRole: OrgRole): boolean {
  return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[minimumRole] ?? 0);
}

export function canManageRole(actorRole: OrgRole, targetRole: OrgRole): boolean {
  // Can only manage roles below your own level
  return (ROLE_HIERARCHY[actorRole] ?? 0) > (ROLE_HIERARCHY[targetRole] ?? 0);
}
