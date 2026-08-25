import { NextResponse } from "next/server";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { matchFeedItem } from "@/db/schema";
import { auth } from "@/lib/auth";
import { checkEntitlement } from "@/lib/stripe/entitlements";

export const runtime = "nodejs";

/** Safety rail on the response, not a page size — see the query below. */
const MAX_PENDING_RETURNED = 200;

/**
 * GET the current user's pending Daily Match Feed. Gated on the `matchFeed`
 * entitlement — ungated users get `{ entitled: false, matches: [] }` so Phase 5
 * can render a locked teaser without incurring any query/AI cost. Entitled users
 * get up to 10 pending items, newest feed first, then by rank ascending.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkEntitlement(session.user.id, "matchFeed");
    if (!gate.allowed) {
      return NextResponse.json({ entitled: false, matches: [] });
    }

    // EVERY pending match, not just today's batch.
    //
    // A match stays pending until the user accepts or rejects it, so the queue
    // is meant to accumulate — that is the whole point of the status column.
    // This used to `.limit(10)`, which combined with `feedDate DESC` meant only
    // the newest day was ever reachable: 198 undecided matches spanning three
    // weeks were invisible, and the deck reported "1 of 10" then emptied.
    //
    // The bound is now a safety rail rather than a page size. Snapshots average
    // 191 bytes, so even 200 items is ~38 kB.
    const rows = await db
      .select()
      .from(matchFeedItem)
      .where(
        and(
          eq(matchFeedItem.userId, session.user.id),
          eq(matchFeedItem.status, "pending")
        )
      )
      .orderBy(desc(matchFeedItem.feedDate), asc(matchFeedItem.rank))
      .limit(MAX_PENDING_RETURNED);

    // The true backlog, so the UI can say so even if the rail above trims.
    const [{ value: totalPending }] = await db
      .select({ value: count() })
      .from(matchFeedItem)
      .where(
        and(
          eq(matchFeedItem.userId, session.user.id),
          eq(matchFeedItem.status, "pending")
        )
      );

    return NextResponse.json({
      entitled: true,
      totalPending,
      matches: rows.map((r) => ({
        id: r.id,
        cvr: r.cvr,
        companySnapshot: r.companySnapshot,
        rank: r.rank,
        score: r.score,
        reason: r.reason,
        feedDate: r.feedDate,
        status: r.status,
      })),
    });
  } catch (error) {
    console.error("Failed to load match feed:", error);
    return NextResponse.json(
      { error: "Failed to load match feed" },
      { status: 500 }
    );
  }
}
