import "server-only";

import { and, eq, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { member } from "@/db/auth-schema";
import { logOrgEvent } from "@/lib/team/audit";
import { userPlanHasTeamFeatures } from "@/lib/team/permissions";
import { isOwnerless, pickSuccessor, type MemberRole } from "@/lib/team/ownership-recovery";

/**
 * Give every ownerless organization an owner again.
 *
 * The selection rule is pure and lives in `ownership-recovery.ts`; this applies
 * it. Safe to run repeatedly — an org that already has an owner is skipped, and
 * the promotion itself is conditional, so a concurrent transfer-ownership wins
 * rather than being overwritten.
 *
 * @returns how many organizations were repaired
 */
export async function recoverOwnerlessOrgs(): Promise<number> {
  // A self-referencing NOT EXISTS on `member` needs an alias, or it correlates
  // with the row being updated instead of the org's owner row.
  const ownerCheck = alias(member, "owner_check");

  const rows = await db
    .select({
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
    })
    .from(member);

  const byOrg = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byOrg.get(row.organizationId) ?? [];
    list.push(row);
    byOrg.set(row.organizationId, list);
  }

  let recovered = 0;

  for (const [organizationId, members] of byOrg) {
    if (!isOwnerless(members.map((m) => ({ role: m.role as MemberRole })))) continue;

    // Plan status is resolved here rather than inside the picker, so the rule
    // stays testable without a database.
    const candidates = await Promise.all(
      members.map(async (m) => ({
        userId: m.userId,
        role: m.role as MemberRole,
        createdAt: m.createdAt,
        hasTeamFeatures: await userPlanHasTeamFeatures(m.userId),
      }))
    );

    const successor = pickSuccessor(candidates);
    if (!successor) continue;

    const promoted = await db
      .update(member)
      .set({ role: "owner" })
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.userId, successor.userId),
          // Still ownerless at write time — otherwise a transfer that landed
          // moments ago would be silently undone.
          notExists(
            db
              .select({ one: sql`1` })
              .from(ownerCheck)
              .where(
                and(
                  eq(ownerCheck.organizationId, organizationId),
                  eq(ownerCheck.role, "owner")
                )
              )
          )
        )
      )
      .returning({ id: member.id });

    if (promoted.length === 0) continue;

    recovered++;
    await logOrgEvent({
      organizationId,
      // No human did this; the system repaired an unreachable state.
      actorId: null,
      action: "ownership_recovered",
      targetUserId: successor.userId,
      metadata: { previousRole: successor.role, reason: "owner_account_removed" },
    });
  }

  return recovered;
}
