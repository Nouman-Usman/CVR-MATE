import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { matchFeedItem, matchProfile } from "@/db/schema";
import { auth } from "@/lib/auth";
import { validateActiveOrg } from "@/lib/team/permissions";
import { saveCompany } from "@/lib/saved-companies";
import { applyDecision } from "@/lib/match-feed/learn";
import type { MatchPreferences } from "@/lib/match-feed/rank";
import type { MatchCompanySnapshot } from "@/lib/match-feed/generate";

export const runtime = "nodejs";

/**
 * PATCH accept/reject a single pending feed item. Records the decision, teaches
 * the user's learned preferences, and (on accept) saves the company. Idempotent:
 * a re-decided item returns its existing status without side effects.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const activeOrgId = await validateActiveOrg(
      session.user.id,
      session.session?.activeOrganizationId
    );

    // Parse + normalize the decision.
    const body = await req.json().catch(() => ({}));
    const raw = typeof body?.decision === "string" ? body.decision : "";
    let decision: "accepted" | "rejected";
    if (raw === "accept" || raw === "accepted") {
      decision = "accepted";
    } else if (raw === "reject" || raw === "rejected") {
      decision = "rejected";
    } else {
      return NextResponse.json({ error: "invalid decision" }, { status: 400 });
    }

    // Load the item, scoped to its owner.
    const item = await db.query.matchFeedItem.findFirst({
      where: and(
        eq(matchFeedItem.id, id),
        eq(matchFeedItem.userId, session.user.id)
      ),
    });
    if (!item) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    // Idempotent — the item was already decided.
    if (item.status !== "pending") {
      return NextResponse.json({
        ok: true,
        status: item.status,
        alreadyDecided: true,
      });
    }

    // 1. Record the decision on the feed item.
    await db
      .update(matchFeedItem)
      .set({ status: decision, decidedAt: new Date() })
      .where(eq(matchFeedItem.id, id));

    // 2. Teach — update the learned preferences. Manual find-then-update/insert
    //    upsert (mirrors the engine) so updatedAt's $onUpdate fires.
    const profile = await db.query.matchProfile.findFirst({
      where: eq(matchProfile.userId, session.user.id),
    });
    const nextPrefs = applyDecision(
      (profile?.preferences ?? {}) as MatchPreferences,
      item.companySnapshot as MatchCompanySnapshot | null,
      decision
    );
    if (profile) {
      await db
        .update(matchProfile)
        .set({ preferences: nextPrefs })
        .where(eq(matchProfile.userId, session.user.id));
    } else {
      await db
        .insert(matchProfile)
        .values({ userId: session.user.id, preferences: nextPrefs })
        .onConflictDoNothing();
    }

    // 3. On accept, save the company to the user's list (no cap here — the feed
    //    intentionally does not enforce the saved-companies entitlement limit).
    let saved: string | undefined;
    if (decision === "accepted") {
      const result = await saveCompany(session.user.id, activeOrgId, item.cvr);
      saved = result.status;
    }

    return NextResponse.json({ ok: true, status: decision, saved });
  } catch (error) {
    console.error("Failed to record match decision:", error);
    return NextResponse.json(
      { error: "Failed to record decision" },
      { status: 500 }
    );
  }
}
