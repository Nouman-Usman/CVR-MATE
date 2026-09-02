import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { followedCompany } from "@/db/schema";
import { checkUsageEntitlement } from "@/lib/stripe/entitlements";
import {
  TeamPermissionError,
  assertCanMutateResource,
  teamErrorToStatus,
} from "@/lib/team/permissions";
import { resolveWorkspace } from "@/lib/workspace/resolve";
import { orgIdForWrite } from "@/lib/workspace/types";
import { workspaceScope } from "@/lib/workspace/scope";
import { logActivity } from "@/lib/activity/log";

/**
 * Subscription management for company alerts.
 *
 * Purely about who is subscribed — detection lives in `lib/annual-reports/`
 * and knows nothing about this route. Reuses the established authorization
 * pieces rather than inventing a company-specific model:
 *
 *   resolveWorkspace        → personal or org scope
 *   assertCanMutateResource → admins-or-creator on org rows
 *   checkUsageEntitlement   → the `followedCompanies` plan limit
 *
 * Following is NOT saving. `savedCompany` is a bookmark; a follow is a
 * subscription that produces notifications, so it has its own limit and its
 * own lifecycle.
 */

/** GET — the current workspace's active follows. */
export async function GET(req: NextRequest) {
  const resolved = await resolveWorkspace(req);
  if (!resolved.ok) return resolved.response;
  const { workspace } = resolved;

  try {
    const rows = await db
      .select()
      .from(followedCompany)
      .where(
        and(
          workspaceScope(workspace, {
            userId: followedCompany.userId,
            organizationId: followedCompany.organizationId,
          }),
          eq(followedCompany.isActive, true)
        )
      )
      .orderBy(desc(followedCompany.createdAt));

    return NextResponse.json({
      results: rows.map((f) => ({
        id: f.id,
        cvr: f.cvr,
        companyName: f.companyName,
        note: f.note,
        // Null means this follow has never been polled — its next run seeds
        // silently. Exposed so the UI can say "watching from the next check".
        lastCheckedAt: f.lastCheckedAt?.toISOString() ?? null,
        // Who subscribed. S5 needs this: the follower is a notification
        // recipient even when they cannot manage the org's follows.
        followerId: f.userId,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to list followed companies:", error);
    return NextResponse.json({ error: "Failed to list followed companies" }, { status: 500 });
  }
}

/** POST — follow a company in the current workspace. */
export async function POST(req: NextRequest) {
  const resolved = await resolveWorkspace(req);
  if (!resolved.ok) return resolved.response;
  const { workspace } = resolved;
  const userId = workspace.userId;

  try {
    const body = await req.json().catch(() => ({}));
    const cvr = String(body.cvr ?? "").trim();
    const companyName = String(body.companyName ?? "").trim();

    if (!/^\d{8}$/.test(cvr)) {
      return NextResponse.json({ error: "Valid 8-digit CVR number is required" }, { status: 400 });
    }
    if (!companyName) {
      return NextResponse.json({ error: "companyName is required" }, { status: 400 });
    }

    // A follow belongs to a user — `uniqueIndex(userId, cvr)` — so an existing
    // row is reactivated rather than duplicated. Reactivating deliberately
    // preserves `lastCheckedAt`: this user has already seen the baseline, so
    // re-following must not replay historical reports.
    const existing = await db.query.followedCompany.findFirst({
      where: and(eq(followedCompany.userId, userId), eq(followedCompany.cvr, cvr)),
    });

    if (existing?.isActive) {
      return NextResponse.json({ followed: true, alreadyFollowed: true });
    }

    // Limit counts ACTIVE follows only, so unfollowing frees a slot.
    const [{ value: activeCount }] = await db
      .select({ value: count() })
      .from(followedCompany)
      .where(and(eq(followedCompany.userId, userId), eq(followedCompany.isActive, true)));

    const { allowed, limit } = await checkUsageEntitlement(
      userId,
      "followedCompanies",
      activeCount
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            limit === 0
              ? "Company alerts require a paid plan."
              : `Follow limit reached (${limit}). Upgrade your plan for more.`,
          upgrade: true,
          limit,
        },
        { status: 403 }
      );
    }

    if (existing) {
      await db
        .update(followedCompany)
        .set({ isActive: true, companyName })
        .where(eq(followedCompany.id, existing.id));

      await logActivity({
        userId,
        organizationId: existing.organizationId,
        entityType: "company",
        entityId: existing.id,
        action: "followed",
        metadata: { cvr, companyName, reactivated: true },
      });

      return NextResponse.json({ followed: true, reactivated: true });
    }

    const [created] = await db
      .insert(followedCompany)
      .values({
        userId,
        // NULL means personal. Read from the workspace so the scope is a
        // consequence of a choice the user can see, not an ambient default.
        organizationId: orgIdForWrite(workspace),
        cvr,
        companyName,
        note: body.note ? String(body.note) : null,
      })
      .returning({ id: followedCompany.id, organizationId: followedCompany.organizationId });

    await logActivity({
      userId,
      organizationId: created.organizationId,
      entityType: "company",
      entityId: created.id,
      action: "followed",
      metadata: { cvr, companyName },
    });

    return NextResponse.json({ followed: true, id: created.id }, { status: 201 });
  } catch (error) {
    console.error("Failed to follow company:", error);
    return NextResponse.json({ error: "Failed to follow company" }, { status: 500 });
  }
}

/**
 * DELETE — stop alerts.
 *
 * `?cvr=` acts on the caller's own follow. `?id=` may target any follow and is
 * governed by `assertCanMutateResource`, which already means "the creator, or
 * an admin/owner of the organization" — the same rule every other org resource
 * uses.
 *
 * Deactivates rather than deletes: the cron's active set is `isActive = true`,
 * and keeping the row preserves `lastCheckedAt` so a re-follow does not replay
 * history as though it were news.
 */
export async function DELETE(req: NextRequest) {
  const resolved = await resolveWorkspace(req);
  if (!resolved.ok) return resolved.response;
  const userId = resolved.workspace.userId;

  const id = req.nextUrl.searchParams.get("id");
  const cvr = req.nextUrl.searchParams.get("cvr");

  if (!id && !cvr) {
    return NextResponse.json({ error: "id or cvr parameter is required" }, { status: 400 });
  }

  try {
    const target = id
      ? await db.query.followedCompany.findFirst({ where: eq(followedCompany.id, id) })
      : await db.query.followedCompany.findFirst({
          where: and(eq(followedCompany.userId, userId), eq(followedCompany.cvr, cvr!)),
        });

    // 404 rather than 403 for a row the caller cannot see — not confirming that
    // an id exists is the same IDOR posture the CRM guards use.
    if (!target) {
      return NextResponse.json({ error: "Follow not found" }, { status: 404 });
    }

    await assertCanMutateResource(userId, {
      userId: target.userId,
      organizationId: target.organizationId,
    });

    await db
      .update(followedCompany)
      .set({ isActive: false })
      .where(eq(followedCompany.id, target.id));

    // `onBehalfOf` distinguishes an admin silencing someone else's alerts from
    // a user unfollowing their own — the follow row names the subscriber, not
    // whoever pressed the button.
    await logActivity({
      userId,
      organizationId: target.organizationId,
      entityType: "company",
      entityId: target.id,
      action: "unfollowed",
      metadata: {
        cvr: target.cvr,
        companyName: target.companyName,
        onBehalfOf: target.userId === userId ? undefined : target.userId,
      },
    });

    return NextResponse.json({ unfollowed: true });
  } catch (error) {
    if (error instanceof TeamPermissionError) {
      return NextResponse.json({ error: error.message }, { status: teamErrorToStatus(error) });
    }
    console.error("Failed to unfollow company:", error);
    return NextResponse.json({ error: "Failed to unfollow company" }, { status: 500 });
  }
}
