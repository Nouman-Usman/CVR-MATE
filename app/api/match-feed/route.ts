import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { matchFeedItem } from "@/db/schema";
import { auth } from "@/lib/auth";
import { checkEntitlement } from "@/lib/stripe/entitlements";

export const runtime = "nodejs";

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
      .limit(10);

    return NextResponse.json({
      entitled: true,
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
