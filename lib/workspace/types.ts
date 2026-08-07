import type { OrgRole } from "@/lib/team/permissions";

/**
 * Which workspace a request is acting in.
 *
 * Deliberately a discriminated union rather than a nullable organization id.
 * "Active organization" was doing two jobs at once — *whose behalf am I acting
 * on* and *which data am I looking at* — and for the ten tables that can hold
 * either personal or org rows those are different questions. A `string | null`
 * invites `?? null` at the call site, which is exactly how saving a company
 * came to silently make it org property.
 *
 * Client-safe: types plus one pure helper, no `server-only`, so the switcher
 * and the hooks can share this vocabulary.
 */
export type Workspace =
  | { type: "personal"; userId: string }
  | { type: "org"; id: string; userId: string; role: OrgRole };

export const PERSONAL_WORKSPACE_ID = "personal" as const;

/** Stable key for query caches, storage and UI selection. */
export function workspaceKey(workspace: Workspace): string {
  return workspace.type === "personal" ? PERSONAL_WORKSPACE_ID : `org:${workspace.id}`;
}

/**
 * The organization id to stamp on a new row in a dual-scoped table.
 *
 * NULL means personal. Reading this from the workspace rather than from an
 * ambient `activeOrgId ?? null` is the whole point: the value becomes a
 * consequence of a choice the user made and can see on screen.
 */
export function orgIdForWrite(workspace: Workspace): string | null {
  return workspace.type === "org" ? workspace.id : null;
}

/** Whether this workspace can reach org-only tables (quotes, deals, contacts). */
export function isOrgWorkspace(
  workspace: Workspace
): workspace is Extract<Workspace, { type: "org" }> {
  return workspace.type === "org";
}
