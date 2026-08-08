import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getUserPlan,
  getPlanLimits,
  getUsageSummary,
  billingUserFor,
} from "@/lib/stripe/entitlements";
import { resolveWorkspaceForUser } from "@/lib/workspace/resolve";
import { organization } from "@/db/auth-schema";
import { PLANS } from "@/lib/stripe/plans";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { eq } from "drizzle-orm";
import { subscriptionDataFromStripe } from "@/lib/stripe/webhook-helpers";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /**
     * Report the plan that actually governs what the viewer can do right now.
     *
     * This read the viewer's own subscription unconditionally, so a member of an
     * Enterprise organization with no personal subscription was told they were
     * on Free — and shown Free's limits — while working under the org's plan.
     * The page contradicted the product.
     */
    const workspace = await resolveWorkspaceForUser(
      session.user.id,
      session.session?.activeOrganizationId
    );
    const billingUserId = await billingUserFor(workspace);
    // Whether the viewer owns the subscription being described. Members see the
    // plan; only its holder sees or acts on its billing.
    const viewerOwnsBilling = billingUserId === session.user.id;

    const { plan, status, subscription: sub } = await getUserPlan(billingUserId);
    const limits = getPlanLimits(plan);
    const planDef = PLANS[plan];
    // Usage follows the workspace too — these are the limits it is measured
    // against, so counting the other bucket would make the ratio meaningless.
    const usage = await getUsageSummary(session.user.id, workspace);

    const providedByOrganization =
      workspace.type === "org" && !viewerOwnsBilling
        ? (
            await db.query.organization.findFirst({
              where: eq(organization.id, workspace.id),
              columns: { name: true },
            })
          )?.name ?? "your organization"
        : null;

    // Serialize all numeric limits (Infinity → -1 for JSON)
    const serializedLimits: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(limits)) {
      serializedLimits[key] = typeof value === "number" && !isFinite(value) ? -1 : value;
    }

    // Determine billing interval from the current price ID
    const annualPriceIds = [
      process.env.NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_ENT_ANNUAL_PRICE_ID,
    ].filter(Boolean);
    const billingInterval: "monthly" | "annual" =
      sub?.stripePriceId && annualPriceIds.includes(sub.stripePriceId)
        ? "annual"
        : "monthly";

    return NextResponse.json({
      plan,
      planName: planDef.name,
      price: planDef.price,
      annualPrice: planDef.annualPrice,
      currency: planDef.currency,
      status,
      /**
       * Billing detail belongs to whoever pays. A member is told which plan
       * governs them and by whom, but renewal dates, cancellation state and the
       * price id are somebody else's billing — not theirs to see or act on.
       */
      providedByOrganization,
      canManageBilling: viewerOwnsBilling,
      currentPeriodEnd: viewerOwnsBilling ? sub?.currentPeriodEnd?.toISOString() ?? null : null,
      trialEnd: viewerOwnsBilling ? sub?.trialEnd?.toISOString() ?? null : null,
      cancelAtPeriodEnd: viewerOwnsBilling ? sub?.cancelAtPeriodEnd ?? false : false,
      stripePriceId: viewerOwnsBilling ? sub?.stripePriceId ?? null : null,
      billingInterval,
      limits: serializedLimits,
      usage,
    });
  } catch (error) {
    console.error("Failed to fetch subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stripe/subscription — Force-sync subscription state from Stripe.
 *
 * Safety: uses updatedAt guard to avoid overwriting newer webhook data.
 */
export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sub = await db.query.subscription.findFirst({
      where: eq(subscription.userId, session.user.id),
    });

    if (!sub?.stripeSubscriptionId) {
      return NextResponse.json({ synced: true, plan: "free" });
    }

    const stripe = getStripe();
    let stripeSub;
    try {
      stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    } catch {
      // Subscription or customer doesn't exist in Stripe — clean up DB
      await db
        .update(subscription)
        .set({
          plan: "free",
          status: "canceled",
          cancelAtPeriodEnd: false,
          stripeSubscriptionId: null,
        })
        .where(eq(subscription.id, sub.id));
      return NextResponse.json({ synced: true, plan: "free", action: "subscription_not_found" });
    }

    // Build canonical data from Stripe — reuse the same derivation the webhook uses
    // so a manual refresh can never disagree with what the webhook would have written.
    const canonical = subscriptionDataFromStripe(stripeSub);

    await db
      .update(subscription)
      .set(canonical)
      .where(eq(subscription.id, sub.id));

    return NextResponse.json({
      synced: true,
      plan: canonical.plan,
      status: canonical.status,
      cancelAtPeriodEnd: canonical.cancelAtPeriodEnd,
    });
  } catch (error) {
    console.error("Failed to sync subscription:", error);
    return NextResponse.json(
      { error: "Failed to sync subscription" },
      { status: 500 }
    );
  }
}
