/**
 * DEV-ONLY: End-to-end match-feed test endpoint.
 *
 * Runs the full Phase-2 match funnel for the CURRENT SESSION user and returns a
 * step-by-step breakdown plus the generated matches. Session-based (no bearer
 * token) for browser ergonomics while `pnpm dev` runs.
 *
 * Usage (while logged in): open in a browser
 *   http://localhost:3000/api/dev/test-match-feed          (dry run — no writes)
 *   http://localhost:3000/api/dev/test-match-feed?persist=1 (also persists rows)
 *
 * NEVER deployed to production — guarded by NODE_ENV check.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { validateActiveOrg } from "@/lib/team/permissions";
import { generateMatchFeed, persistMatchFeed, toFeedDate } from "@/lib/match-feed/generate";

export async function GET(req: NextRequest) {
  // ── Guard ────────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // ── Auth (session-based) ────────────────────────────────────────────────
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const activeOrgId = await validateActiveOrg(userId, session.session?.activeOrganizationId);

    // ── Run the funnel (dry run by default) ─────────────────────────────────
    const result = await generateMatchFeed({
      userId,
      organizationId: activeOrgId,
      locale: "en",
      now: new Date(),
    });

    // ── Optional persist ────────────────────────────────────────────────────
    let inserted: number | undefined;
    if (req.nextUrl.searchParams.get("persist") === "1") {
      inserted = await persistMatchFeed({
        userId,
        organizationId: activeOrgId,
        matches: result.matches,
        feedDate: toFeedDate(new Date()),
      });
    }

    return NextResponse.json({
      ok: true,
      steps: result.steps,
      matchCount: result.matches.length,
      matches: result.matches,
      inserted,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
