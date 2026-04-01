import "server-only";

import { createHash } from "crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Structured role stored in personRoleSnapshot.rolesJson */
export interface SnapshotRole {
  type: string;
  start: string | null;
  end: string | null;
  title: string | null;
  owner_percent: number | null;
  owner_voting_percent: number | null;
}

/** A detected change event */
export interface RoleChange {
  eventType:
    | "role_added"
    | "role_removed"
    | "role_updated"
    | "company_status_changed"
    | "company_bankrupt";
  eventCategory: "role" | "company" | "ownership";
  participantNumber: string;
  personName: string;
  companyVat: string;
  companyName: string;
  role: SnapshotRole | null;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  importance: "low" | "normal" | "high";
}

// High-importance roles: changes to these trigger "high" importance events
const HIGH_IMPORTANCE_ROLES = new Set([
  "director",
  "owner",
  "real_owner",
  "daily_management",
]);

// ─── Role identity ──────────────────────────────────────────────────────────
// A role is identified by (type + start_date). Same role type can exist at
// different times in the same company.

function roleKey(r: SnapshotRole): string {
  return `${r.type}::${r.start ?? ""}`;
}

// ─── Diff engine ────────────────────────────────────────────────────────────

export function diffRoles(
  oldRoles: SnapshotRole[],
  newRoles: SnapshotRole[],
  context: {
    participantNumber: string;
    personName: string;
    companyVat: string;
    companyName: string;
  }
): RoleChange[] {
  const changes: RoleChange[] = [];
  const oldMap = new Map(oldRoles.map((r) => [roleKey(r), r]));
  const newMap = new Map(newRoles.map((r) => [roleKey(r), r]));

  // Detect added roles (in new but not in old)
  for (const [key, newRole] of newMap) {
    if (!oldMap.has(key)) {
      const isOwnership =
        newRole.owner_percent != null || newRole.owner_voting_percent != null;
      changes.push({
        eventType: "role_added",
        eventCategory: isOwnership ? "ownership" : "role",
        ...context,
        role: newRole,
        previousValue: null,
        newValue: { role: newRole },
        importance: HIGH_IMPORTANCE_ROLES.has(newRole.type) ? "high" : "normal",
      });
    }
  }

  // Detect removed roles (in old but not in new)
  for (const [key, oldRole] of oldMap) {
    if (!newMap.has(key)) {
      changes.push({
        eventType: "role_removed",
        eventCategory: oldRole.owner_percent != null ? "ownership" : "role",
        ...context,
        role: oldRole,
        previousValue: { role: oldRole },
        newValue: null,
        importance: HIGH_IMPORTANCE_ROLES.has(oldRole.type) ? "high" : "normal",
      });
    }
  }

  // Detect changed roles (same identity, different fields)
  for (const [key, newRole] of newMap) {
    const oldRole = oldMap.get(key);
    if (!oldRole) continue;

    const diffs: string[] = [];
    if (oldRole.end !== newRole.end) diffs.push("end");
    if (oldRole.title !== newRole.title) diffs.push("title");
    if (oldRole.owner_percent !== newRole.owner_percent) diffs.push("owner_percent");
    if (oldRole.owner_voting_percent !== newRole.owner_voting_percent) diffs.push("owner_voting_percent");

    if (diffs.length > 0) {
      const isOwnershipChange = diffs.includes("owner_percent") || diffs.includes("owner_voting_percent");
      changes.push({
        eventType: "role_updated",
        eventCategory: isOwnershipChange ? "ownership" : "role",
        ...context,
        role: newRole,
        previousValue: { role: oldRole, changedFields: diffs },
        newValue: { role: newRole, changedFields: diffs },
        importance: HIGH_IMPORTANCE_ROLES.has(newRole.type) ? "high" : "normal",
      });
    }
  }

  return changes;
}

// ─── Company-level diffs ────────────────────────────────────────────────────

export function diffCompanyStatus(
  oldStatus: string | null,
  newStatus: string | null,
  oldBankrupt: boolean,
  newBankrupt: boolean,
  context: {
    participantNumber: string;
    personName: string;
    companyVat: string;
    companyName: string;
  }
): RoleChange[] {
  const changes: RoleChange[] = [];

  if (oldStatus !== newStatus && newStatus) {
    changes.push({
      eventType: "company_status_changed",
      eventCategory: "company",
      ...context,
      role: null,
      previousValue: { status: oldStatus },
      newValue: { status: newStatus },
      importance: "normal",
    });
  }

  if (!oldBankrupt && newBankrupt) {
    changes.push({
      eventType: "company_bankrupt",
      eventCategory: "company",
      ...context,
      role: null,
      previousValue: { bankrupt: false },
      newValue: { bankrupt: true },
      importance: "high",
    });
  }

  return changes;
}

// ─── Event hash for deduplication ───────────────────────────────────────────

export function computeEventHash(change: RoleChange): string {
  const payload = JSON.stringify({
    pn: change.participantNumber,
    cv: change.companyVat,
    et: change.eventType,
    r: change.role,
    nv: change.newValue,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

// ─── Extract structured roles from raw CVR participant data ─────────────────

export function extractRoles(
  rawRoles: { type: string; life: Record<string, unknown> }[]
): SnapshotRole[] {
  return rawRoles.map((r) => ({
    type: r.type,
    start: (r.life.start as string) ?? null,
    end: (r.life.end as string) ?? null,
    title: (r.life.title as string) ?? null,
    owner_percent: (r.life.owner_percent as number) ?? null,
    owner_voting_percent: (r.life.owner_voting_percent as number) ?? null,
  }));
}
