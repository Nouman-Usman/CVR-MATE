import "server-only";

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getOrgMembership } from "@/lib/team/permissions";

import type { Workspace } from "./types";

/**
 * Deciding which workspace a request is acting in.
 *
 * The rule is: the session names an organization the user is *still* a member
 * of, or you are in your personal workspace. Nothing is inferred.
 *
 * That last part is the change. `validateActiveOrg` falls back to the user's
 * oldest membership whenever the session carries no active org, so accepting an
 * invitation moved someone into org context without their choosing it — and
 * with no switcher, permanently. Personal has to be somewhere you can *be*, not
 * a gap the system fills in.
 *
 * Membership is re-read from the database every time. `getOrgMembership` never
 * trusts the 5-minute session cookie cache, so removing or demoting someone
 * takes effect on their next request; resolving through it keeps that property.
 */

export type WorkspaceResult =
  | { ok: true; workspace: Workspace }
  | { ok: false; response: NextResponse };

/**
 * The core rule, separated from HTTP so it can be tested directly.
 *
 * An org id the user is not a member of resolves to personal rather than
 * throwing: a stale session pointing at an org someone was removed from is an
 * ordinary situation, not an error, and the safe reading of an unrecognised
 * claim is "no organization" — never "some other organization".
 */
export async function resolveWorkspaceForUser(
  userId: string,
  activeOrgId: string | null | undefined
): Promise<Workspace> {
  if (!activeOrgId) return { type: "personal", userId };

  const membership = await getOrgMembership(userId, activeOrgId);
  if (!membership) return { type: "personal", userId };

  return { type: "org", id: activeOrgId, userId, role: membership.role };
}

/** Resolve from a request. Only authentication can fail here. */
export async function resolveWorkspace(req: { headers: Headers }): Promise<WorkspaceResult> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const workspace = await resolveWorkspaceForUser(
    session.user.id,
    session.session?.activeOrganizationId
  );

  return { ok: true, workspace };
}
