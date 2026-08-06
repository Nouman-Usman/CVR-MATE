import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quote } from "@/db/schema";
import { isWellFormedToken } from "@/lib/quotes/public-token";
import { isRenderableSnapshot } from "@/lib/quotes/snapshot";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";

export const runtime = "nodejs";

/** Statuses whose document is still open for a decision. */
const OPEN = "sent";

/**
 * GET /api/public/quotes/[token] — the customer's view of a quote.
 *
 * UNAUTHENTICATED. The token is the entire authorization, so this endpoint:
 *   - never accepts an id, an org, or any other selector,
 *   - returns only the frozen snapshot, never live rows or internal ids,
 *   - answers 404 identically for "no such token", "deleted", and "never sent",
 *     so it cannot be used to probe which tokens exist,
 *   - rate limits by IP and fails CLOSED, because it is the one CRM surface
 *     with no account behind it.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`quote-ip:${ip}`, "public_quote_view", 60, 60, {
    failClosed: true,
  });
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { token } = await params;
    // Cheap shape filter so scanners never reach the database.
    if (!isWellFormedToken(token)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const row = await db.query.quote.findFirst({
      where: eq(quote.publicToken, token),
    });

    if (!row || row.deletedAt || !isRenderableSnapshot(row.snapshot)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const expired =
      !!row.snapshot.validUntil &&
      row.snapshot.validUntil < new Date().toISOString().slice(0, 10);

    // Only the snapshot leaves the building — no organizationId, no quote id,
    // no deal, no createdBy.
    return NextResponse.json({
      snapshot: row.snapshot,
      status: row.status,
      canRespond: row.status === OPEN && !expired,
      expired,
      respondedAt: row.acceptedAt ?? row.rejectedAt ?? null,
    });
  } catch (err) {
    console.error("[public-quote] view failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
