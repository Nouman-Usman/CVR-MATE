import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { member, organization, verification } from "@/db/auth-schema";
import { subscription } from "@/db/app-schema";
import { eq, and, ne, inArray } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * DELETE /api/user
 *
 * GDPR Article 17 — Right to erasure ("right to be forgotten").
 *
 * Deletes the authenticated user's account and all associated data.
 * Because most app tables reference user.id with ON DELETE CASCADE,
 * a single DELETE on the user row removes everything atomically.
 *
 * Blocked if the user is the sole owner of an organisation with other
 * members — they must transfer ownership or dissolve the team first.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // ─── Check for owned organisations with other members ──────────────────
    // If the user owns an org with other members they must transfer ownership
    // or dissolve the team before deleting their account.
    const ownedMemberships = await db.query.member.findMany({
      where: and(eq(member.userId, userId), eq(member.role, "owner")),
    });

    if (ownedMemberships.length === 0) {
      // Fast path: user owns no orgs, proceed to deletion
    } else {
      const ownedOrgIds = ownedMemberships.map((m) => m.organizationId);

      // Single batch query instead of per-org loop
      const otherMember = await db.query.member.findFirst({
        where: and(
          inArray(member.organizationId, ownedOrgIds),
          ne(member.userId, userId)
        ),
      });

      if (otherMember) {
        return NextResponse.json(
          {
            error: "account_has_team",
            message:
              "You are the owner of an organisation with other members. " +
              "Transfer ownership or remove all members before deleting your account.",
            organizationId: otherMember.organizationId,
          },
          { status: 409 }
        );
      }

      // ─── Delete sole-owned organisations (user is the only member) ─────────
      // These would otherwise be orphaned (no members, no owner) after cascade.
      // Single batch delete instead of per-org loop
      await db.delete(organization).where(inArray(organization.id, ownedOrgIds));
    }

    // ─── Cancel active Stripe subscription immediately ─────────────────────
    // Stripe subscriptions don't cascade via FK — must cancel explicitly.
    const activeSub = await db.query.subscription.findFirst({
      where: and(
        eq(subscription.userId, userId),
        eq(subscription.status, "active")
      ),
    });
    if (activeSub?.stripeSubscriptionId) {
      const stripe = getStripe();
      try {
        await stripe.subscriptions.cancel(activeSub.stripeSubscriptionId);
      } catch (err) {
        console.error("[GDPR] Stripe subscription cancel failed:", err);
        // Non-blocking — proceed with DB delete even if Stripe fails
      }
    }

    // ─── Clean up verification table (no FK cascade) ──────────────────────
    // verification table is keyed by email identifier, not userId.
    await db.delete(verification).where(eq(verification.identifier, session.user.email));

    // ─── Delete the user row — cascades all user-scoped data ───────────────
    //
    // Tables wiped via ON DELETE CASCADE (postgres enforces this atomically):
    //   Auth:  session, account, verification, member, invitation
    //   App:   savedCompany, savedSearch, leadTrigger, triggerResult,
    //          notification, todo, companyNote, userBrand, emailLog,
    //          companyBriefing, outreachMessage, profileEnrichment,
    //          activity, followedPerson, crmConnection (→ crmSyncMapping,
    //          crmSyncLog), subscription, usageRecord, userVideoView
    await db.delete(user).where(eq(user.id, userId));

    console.log(`[GDPR] User ${userId} deleted (right to erasure)`);

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[GDPR] User deletion failed:", err);
    return NextResponse.json({ error: "Deletion failed" }, { status: 500 });
  }
}
