import "server-only";

import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { followedPerson } from "@/db/schema";

/**
 * Persistence for followed people. Mirrors the DB-write of the POST handler in
 * `app/api/followed-people/route.ts` (dedup + reactivate + insert). Auth and
 * entitlement stay in the callers. The route additionally runs an async
 * reverse-index backfill via a route-local helper; that is not reproduced here
 * — the scheduled person-changes cron reconciles it.
 */

export type FollowPersonResult =
  | { status: "already_following" }
  | { status: "reactivated" }
  | { status: "followed" };

/** Count of a user's active follows — mirrors the route's entitlement count. */
export async function countActiveFollows(userId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(followedPerson)
    .where(and(eq(followedPerson.userId, userId), eq(followedPerson.isActive, true)));
  return value;
}

export async function followPerson(
  userId: string,
  participantNumber: string | number,
  personName: string,
  fromVat?: string | null
): Promise<FollowPersonResult> {
  const pn = String(participantNumber);

  const existing = await db.query.followedPerson.findFirst({
    where: and(eq(followedPerson.userId, userId), eq(followedPerson.participantNumber, pn)),
  });

  if (existing) {
    if (!existing.isActive) {
      await db.update(followedPerson).set({ isActive: true }).where(eq(followedPerson.id, existing.id));
      return { status: "reactivated" };
    }
    return { status: "already_following" };
  }

  await db.insert(followedPerson).values({
    userId,
    participantNumber: pn,
    personName: String(personName),
    fromVat: fromVat ? String(fromVat) : null,
  });
  return { status: "followed" };
}
