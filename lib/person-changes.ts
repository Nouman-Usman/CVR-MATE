import "server-only";

export interface SnapshotRole {
  type: string;
  start: string | null;
  end: string | null;
  title: string | null;
  owner_percent: number | null;
  owner_voting_percent: number | null;
}

export interface RoleChangeContext {
  participantNumber: string;
  personName: string;
  companyVat: string;
  companyName: string;
}

export interface RoleChange {
  participantNumber: string;
  personName: string;
  companyVat: string;
  companyName: string;
  eventType:
    | "role_added"
    | "role_removed"
    | "role_updated"
    | "company_status_changed"
    | "company_bankrupt";
  eventCategory: "role" | "company" | "ownership";
  role: Record<string, unknown> | null;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  importance: "low" | "normal" | "high";
}

export function extractRoles(rolesRaw: unknown): SnapshotRole[] {
  if (!Array.isArray(rolesRaw)) return [];

  return rolesRaw
    .map((role: unknown) => {
      const r = role as Record<string, unknown>;
      const life = r.life as Record<string, unknown> | undefined;
      return {
        type: String(r.type ?? ""),
        start: life?.start ? String(life.start) : null,
        end: life?.end ? String(life.end) : null,
        title: life?.title ? String(life.title) : null,
        owner_percent: typeof life?.owner_percent === "number" ? life.owner_percent : null,
        owner_voting_percent:
          typeof life?.owner_voting_percent === "number" ? life.owner_voting_percent : null,
      };
    })
    .filter((r) => r.type);
}

export function diffRoles(
  oldRoles: SnapshotRole[],
  newRoles: SnapshotRole[],
  ctx: RoleChangeContext
): RoleChange[] {
  const changes: RoleChange[] = [];

  const oldMap = new Map<string, SnapshotRole>();
  const newMap = new Map<string, SnapshotRole>();

  for (const r of oldRoles) {
    if (!r.end) {
      const key = `${r.type}:${r.title ?? ""}`;
      oldMap.set(key, r);
    }
  }

  for (const r of newRoles) {
    if (!r.end) {
      const key = `${r.type}:${r.title ?? ""}`;
      newMap.set(key, r);
    }
  }

  for (const [key, role] of newMap) {
    if (!oldMap.has(key)) {
      changes.push({
        ...ctx,
        eventType: "role_added",
        eventCategory: "role",
        role: { type: role.type, title: role.title },
        previousValue: null,
        newValue: { role: role.type, title: role.title },
        importance: "high",
      });
    }
  }

  for (const [key, role] of oldMap) {
    if (!newMap.has(key)) {
      changes.push({
        ...ctx,
        eventType: "role_removed",
        eventCategory: "role",
        role: { type: role.type, title: role.title },
        previousValue: { role: role.type, title: role.title },
        newValue: null,
        importance: "high",
      });
    }
  }

  for (const [key, oldRole] of oldMap) {
    const newRole = newMap.get(key);
    if (newRole) {
      const changedFields: string[] = [];
      if (oldRole.owner_percent !== newRole.owner_percent) {
        changedFields.push("ownership");
      }
      if (oldRole.owner_voting_percent !== newRole.owner_voting_percent) {
        changedFields.push("voting_rights");
      }

      if (changedFields.length > 0) {
        changes.push({
          ...ctx,
          eventType: "role_updated",
          eventCategory: "ownership",
          role: { type: oldRole.type, title: oldRole.title },
          previousValue: {
            owner_percent: oldRole.owner_percent,
            owner_voting_percent: oldRole.owner_voting_percent,
          },
          newValue: {
            owner_percent: newRole.owner_percent,
            owner_voting_percent: newRole.owner_voting_percent,
            changedFields,
          },
          importance: oldRole.owner_percent && newRole.owner_percent ? "high" : "normal",
        });
      }
    }
  }

  return changes;
}

export function diffCompanyStatus(
  oldStatus: string | null,
  newStatus: string | null,
  oldBankrupt: boolean,
  newBankrupt: boolean,
  ctx: RoleChangeContext
): RoleChange[] {
  const changes: RoleChange[] = [];

  if (!oldBankrupt && newBankrupt) {
    changes.push({
      ...ctx,
      eventType: "company_bankrupt",
      eventCategory: "company",
      role: null,
      previousValue: { bankrupt: false },
      newValue: { bankrupt: true },
      importance: "high",
    });
  }

  if (oldStatus !== newStatus && newStatus) {
    changes.push({
      ...ctx,
      eventType: "company_status_changed",
      eventCategory: "company",
      role: null,
      previousValue: { status: oldStatus },
      newValue: { status: newStatus },
      importance: newBankrupt ? "high" : "normal",
    });
  }

  return changes;
}

import crypto from "crypto";

export function computeEventHash(change: RoleChange): string {
  const normalized = {
    participantNumber: change.participantNumber,
    companyVat: change.companyVat,
    eventType: change.eventType,
    role: change.role ? JSON.stringify(change.role) : null,
    newValue: change.newValue ? JSON.stringify(change.newValue) : null,
  };
  const str = JSON.stringify(normalized);
  return crypto.createHash("sha256").update(str).digest("hex");
}
