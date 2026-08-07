import { and, eq, isNull, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type { Workspace } from "./types";

/**
 * The WHERE clause for a table that can hold either personal or organization
 * rows — `saved_company`, `todo`, `saved_search`, `lead_trigger`,
 * `followed_person`, `company_note`, `crm_connection`, `activity`,
 * `agent_session`, `match_feed_item`.
 *
 * Exactly one workspace, never both. The previous shape merged them:
 *
 *   or(and(eq(userId, me), isNull(organizationId)),
 *      activeOrgId ? eq(organizationId, activeOrgId) : sql`false`)
 *
 * which put a colleague's row and a private row in the same list, and — because
 * `/api/records/search` had no personal branch at all — made the same saved
 * company visible on one screen and missing on another.
 *
 * Personal rows stay keyed by `userId` as well as a null organization: personal
 * means *mine*, not merely unattached. Organization rows are keyed by the org
 * alone, because that is the point of a shared workspace — a teammate's deal is
 * still the team's deal.
 */
export function workspaceScope(
  workspace: Workspace,
  columns: { userId: AnyPgColumn; organizationId: AnyPgColumn }
): SQL {
  if (workspace.type === "personal") {
    return and(
      eq(columns.userId, workspace.userId),
      isNull(columns.organizationId)
    ) as SQL;
  }
  return eq(columns.organizationId, workspace.id);
}

/**
 * Scope for a table whose personal rows have no `userId` to key on — a row with
 * a null organization belongs to whoever can see it. Used only where the table
 * genuinely lacks a user column; prefer `workspaceScope` everywhere else.
 */
export function workspaceScopeByOrgOnly(
  workspace: Workspace,
  organizationId: AnyPgColumn
): SQL {
  return workspace.type === "personal"
    ? (isNull(organizationId) as SQL)
    : eq(organizationId, workspace.id);
}
