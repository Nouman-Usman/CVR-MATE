import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { member, session } from "@/db/auth-schema";
import { companyWorkspace, deal, leadTrigger, todo } from "@/db/app-schema";

export interface DetachResult {
  triggersDeactivated: number;
  todosUnassigned: number;
  dealsUnassigned: number;
  workspacesUnassigned: number;
  sessionsCleared: number;
}

/**
 * Sever every remaining tie between a user and an organization they are leaving.
 *
 * Deleting the `member` row removes *permission*, but permission is only one of
 * the ties. Three others survive it, and each is a way for someone who is no
 * longer on the team to keep affecting — or hearing from — it:
 *
 *   • lead triggers keep running on their schedule, and the results keep
 *     reaching the departed user, because the trigger row still carries their
 *     user_id. This is the one that leaks data after removal.
 *   • todo / deal / company-workspace assignments still name them, so the org
 *     shows work owned by a person nobody can reassign it from.
 *   • their session still points at the org via `active_organization_id`, so the
 *     app keeps trying to render a workspace every query will now reject.
 *
 * `/leave` used to handle only the first of these and member removal handled
 * none, which meant the two doors out of an organization behaved differently.
 * Both call this now, so they cannot drift apart again.
 *
 * Runs in one transaction: a half-detached member is worse than either state.
 * The membership row itself is NOT deleted here — the callers own that, because
 * they differ on how it is authorised and audited.
 */
export async function detachMemberFromOrg(
  userId: string,
  organizationId: string
): Promise<DetachResult> {
  return db.transaction((tx) => detachWithin(tx, userId, organizationId));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The detach itself, so both entry points can share one transaction. */
async function detachWithin(
  tx: Tx,
  userId: string,
  organizationId: string
): Promise<DetachResult> {
  // Deactivated AND detached: detaching alone would leave an active personal
  // trigger silently inheriting the org's work.
  const triggers = await tx
    .update(leadTrigger)
    .set({ isActive: false, organizationId: null })
    .where(and(eq(leadTrigger.userId, userId), eq(leadTrigger.organizationId, organizationId)))
    .returning({ id: leadTrigger.id });

  const todos = await tx
    .update(todo)
    .set({ assignedUserId: null })
    .where(and(eq(todo.assignedUserId, userId), eq(todo.organizationId, organizationId)))
    .returning({ id: todo.id });

  const deals = await tx
    .update(deal)
    .set({ assignedUserId: null })
    .where(and(eq(deal.assignedUserId, userId), eq(deal.organizationId, organizationId)))
    .returning({ id: deal.id });

  const workspaces = await tx
    .update(companyWorkspace)
    .set({ assignedUserId: null })
    .where(
      and(
        eq(companyWorkspace.assignedUserId, userId),
        eq(companyWorkspace.organizationId, organizationId)
      )
    )
    .returning({ id: companyWorkspace.id });

  // Only sessions pointing at THIS org — the user may legitimately be sitting
  // in another workspace, and clearing that would log them out of it.
  const sessions = await tx
    .update(session)
    .set({ activeOrganizationId: null })
    .where(and(eq(session.userId, userId), eq(session.activeOrganizationId, organizationId)))
    .returning({ id: session.id });

  return {
    triggersDeactivated: triggers.length,
    todosUnassigned: todos.length,
    dealsUnassigned: deals.length,
    workspacesUnassigned: workspaces.length,
    sessionsCleared: sessions.length,
  };
}

/**
 * Detach a user and delete their membership, atomically.
 *
 * Callers do their own authorisation and audit logging; this is only the
 * state change, kept in one transaction so a member can never end up removed
 * but still assigned, or detached but still a member.
 */
export async function removeMemberFromOrg(
  userId: string,
  organizationId: string,
  memberId: string
): Promise<DetachResult> {
  return db.transaction(async (tx) => {
    const result = await detachWithin(tx, userId, organizationId);
    await tx.delete(member).where(eq(member.id, memberId));
    return result;
  });
}
