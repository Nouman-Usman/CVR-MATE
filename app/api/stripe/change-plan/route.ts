import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { eq } from "drizzle-orm";
import { priceToPlan } from "@/lib/stripe/plans";

const PLAN_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
};

const VALID_PRICE_IDS = () =>
  [
    process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_ENT_MONTHLY_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_ENT_ANNUAL_PRICE_ID,
  ].filter(Boolean) as string[];

/**
 * POST /api/stripe/change-plan
 *
 * Switches an existing active subscription to a new price (plan or billing interval).
 * - Upgrades: immediate, prorated charge issued
 * - Downgrades: immediate switch, no proration (net-zero — takes full effect next cycle)
 *
 * Also clears cancelAtPeriodEnd if set, so the user stays subscribed after the change.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { priceId } = await req.json();

    if (!priceId || typeof priceId !== "string") {
      return NextResponse.json({ error: "priceId is required" }, { status: 400 });
    }

    if (!VALID_PRICE_IDS().includes(priceId)) {
      return NextResponse.json({ error: "Invalid price ID" }, { status: 400 });
    }

    const sub = await db.query.subscription.findFirst({
      where: eq(subscription.userId, session.user.id),
    });

    if (!sub?.stripeSubscriptionId || sub.status === "canceled") {
      return NextResponse.json(
        { error: "No active subscription to change. Use checkout to start a new plan." },
        { status: 400 }
      );
    }

    if (sub.stripePriceId === priceId) {
      return NextResponse.json({ error: "Already on this plan" }, { status: 400 });
    }

    const stripe = getStripe();

    // Fetch live subscription to get the current item ID
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    const item = stripeSub.items.data[0];

    if (!item) {
      return NextResponse.json({ error: "Subscription has no items" }, { status: 400 });
    }

    const currentPlan = priceToPlan(sub.stripePriceId ?? undefined);
    const newPlan = priceToPlan(priceId);
    const isUpgrade = (PLAN_ORDER[newPlan] ?? 0) > (PLAN_ORDER[currentPlan] ?? 0);

    // Update the Stripe subscription
    // - Upgrades: create_prorations charges the difference immediately
    // - Downgrades / interval changes: none means no proration credit; new price starts next cycle
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: isUpgrade ? "create_prorations" : "none",
      // Clear any pending cancellation so the subscription continues
      cancel_at_period_end: false,
    });

    // Optimistically write to DB — the webhook will confirm and sync period dates
    await db
      .update(subscription)
      .set({
        stripePriceId: priceId,
        plan: newPlan,
        cancelAtPeriodEnd: false,
      })
      .where(eq(subscription.userId, session.user.id));

    return NextResponse.json({
      success: true,
      plan: newPlan,
      effective: isUpgrade ? "immediate" : "period_end",
    });
  } catch (error) {
    console.error("Change plan error:", error);
    const message = error instanceof Error ? error.message : "Failed to change plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
