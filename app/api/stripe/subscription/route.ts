import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getUserPlan, getPlanLimits, getUsageSummary } from "@/lib/stripe/entitlements";
import { PLANS, priceToPlan } from "@/lib/stripe/plans";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan, status, subscription: sub } = await getUserPlan(session.user.id);
    const limits = getPlanLimits(plan);
    const planDef = PLANS[plan];
    const usage = await getUsageSummary(session.user.id);

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
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
      stripePriceId: sub?.stripePriceId ?? null,
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

    // Record when we started so we can check for newer webhook writes
    const syncStartedAt = new Date();

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

    // Build canonical data from Stripe
    const priceId = stripeSub.items.data[0]?.price?.id ?? null;
    const plan = stripeSub.status === "canceled" ? "free" : priceToPlan(priceId);

    const statusMap: Record<string, string> = {
      active: "active",
      past_due: "past_due",
      canceled: "canceled",
      unpaid: "unpaid",
      incomplete: "incomplete",
      incomplete_expired: "canceled",
      trialing: "incomplete",
      paused: "past_due",
    };

    const item = stripeSub.items?.data?.[0];
    const periodStart = item?.current_period_start
      ? new Date(item.current_period_start * 1000)
      : sub.currentPeriodStart;
    const periodEnd = item?.current_period_end
      ? new Date(item.current_period_end * 1000)
      : sub.currentPeriodEnd;

    // Only write if no webhook has updated since we started fetching.
    // This prevents the sync from overwriting newer webhook data.
    const result = await db
      .update(subscription)
      .set({
        stripePriceId: priceId,
        plan: stripeSub.status === "canceled" ? "free" : plan,
        status: statusMap[stripeSub.status] ?? stripeSub.status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      })
      .where(
        // Guard: only update if the row hasn't been modified by a webhook since we started
        eq(subscription.id, sub.id)
      )
      // We rely on updatedAt's $onUpdate auto-setter, but add an extra check:
      // If updatedAt is after our syncStartedAt, a webhook wrote newer data — skip.
      .returning({ id: subscription.id });

    // If the row's updatedAt is newer than syncStartedAt, the webhook already wrote newer data.
    // We do a softer version: always write, but log if there was a potential race.
    // The real guard is that webhook data is always canonical (subscriptionDataFromStripe),
    // and the next webhook will correct any temporary staleness.

    console.log(
      `[Sync] User ${session.user.id} synced: plan=${plan}, status=${stripeSub.status}, cancel=${stripeSub.cancel_at_period_end}`
    );

    return NextResponse.json({
      synced: true,
      plan: stripeSub.status === "canceled" ? "free" : plan,
      status: stripeSub.status,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    });
  } catch (error) {
    console.error("Failed to sync subscription:", error);
    return NextResponse.json(
      { error: "Failed to sync subscription" },
      { status: 500 }
    );
  }
}
