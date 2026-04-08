import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { eq } from "drizzle-orm";
import { priceToPlan, type PlanId } from "@/lib/stripe/plans";

const PLAN_HIERARCHY: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
};

function getPriceIdForPlan(plan: PlanId): string | null {
  if (plan === "starter") return process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID ?? null;
  if (plan === "professional") return process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID ?? null;
  if (plan === "enterprise") return process.env.NEXT_PUBLIC_STRIPE_ENT_MONTHLY_PRICE_ID ?? null;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const targetPlan = body.targetPlan as PlanId;

    if (!targetPlan || !["free", "starter", "professional", "enterprise"].includes(targetPlan)) {
      return NextResponse.json({ error: "Invalid target plan" }, { status: 400 });
    }

    const sub = await db.query.subscription.findFirst({
      where: eq(subscription.userId, session.user.id),
    });

    const stripe = getStripe();

    // Derive current plan from stripe_price_id (source of truth), not the plan column
    let currentPlan: PlanId = "free";
    if (sub && (sub.status === "active" || sub.status === "past_due")) {
      if (sub.stripePriceId) {
        const fromPrice = priceToPlan(sub.stripePriceId);
        currentPlan = fromPrice !== "free" ? fromPrice : "free";
      }
      // If cancelled at period end, they're effectively "leaving" — treat as current plan still active for change purposes
    }

    if (currentPlan === targetPlan) {
      return NextResponse.json({ error: "Already on this plan" }, { status: 400 });
    }

    const isUpgrade = PLAN_HIERARCHY[targetPlan] > PLAN_HIERARCHY[currentPlan];

    // ─── No Stripe subscription at all: need a checkout session ───────────
    if (!sub?.stripeSubscriptionId) {
      if (targetPlan === "free") {
        return NextResponse.json({ error: "Already on free plan" }, { status: 400 });
      }
      const priceId = getPriceIdForPlan(targetPlan);
      if (!priceId) {
        return NextResponse.json({ error: "Target plan not available" }, { status: 400 });
      }
      return NextResponse.json({ action: "checkout", priceId });
    }

    // ─── Paid → Free: cancel subscription in Stripe ──────────────────────
    if (targetPlan === "free") {
      // Actually cancel in Stripe (schedule end-of-period cancellation)
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update DB to reflect the cancellation — keep plan name but mark canceling
      await db
        .update(subscription)
        .set({ cancelAtPeriodEnd: true })
        .where(eq(subscription.id, sub.id));

      return NextResponse.json({
        success: true,
        action: "downgrade_scheduled",
        message: "Your plan will change to Free at the end of the billing period.",
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      });
    }

    // ─── From here, targetPlan is a paid plan ────────────────────────────
    const newPriceId = getPriceIdForPlan(targetPlan);
    if (!newPriceId) {
      return NextResponse.json({ error: "Target plan not available" }, { status: 400 });
    }

    // Check if Stripe subscription still exists
    let stripeSub;
    try {
      stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    } catch {
      // Subscription doesn't exist in Stripe anymore — need new checkout
      return NextResponse.json({ action: "checkout", priceId: newPriceId });
    }

    // If subscription is canceled in Stripe, need new checkout
    if (stripeSub.status === "canceled") {
      return NextResponse.json({ action: "checkout", priceId: newPriceId });
    }

    const currentItem = stripeSub.items.data[0];
    if (!currentItem) {
      return NextResponse.json({ error: "Subscription has no items" }, { status: 500 });
    }

    // Update Stripe subscription: change price + reactivate if canceling
    try {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: false,
        items: [{ id: currentItem.id, price: newPriceId }],
        proration_behavior: isUpgrade ? "create_prorations" : "none",
      });
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : "Stripe update failed";
      // If customer or subscription was deleted, clean up DB and redirect to checkout
      if (msg.includes("No such customer") || msg.includes("No such subscription")) {
        await db
          .update(subscription)
          .set({ plan: "free", status: "canceled", cancelAtPeriodEnd: false, stripeSubscriptionId: null })
          .where(eq(subscription.id, sub.id));
        return NextResponse.json({ action: "checkout", priceId: newPriceId });
      }
      throw stripeErr;
    }

    // Update DB: plan name, price ID, cancel flag — all in sync
    const resolvedPlan = priceToPlan(newPriceId);
    await db
      .update(subscription)
      .set({
        stripePriceId: newPriceId,
        plan: resolvedPlan,
        cancelAtPeriodEnd: false,
        status: "active",
      })
      .where(eq(subscription.id, sub.id));

    return NextResponse.json({
      success: true,
      action: isUpgrade ? "upgraded" : "downgraded",
      plan: resolvedPlan,
    });
  } catch (error) {
    console.error("Stripe change-plan error:", error);
    const message = error instanceof Error ? error.message : "Failed to change plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
