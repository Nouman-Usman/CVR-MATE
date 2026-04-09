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

/**
 * Return the correct price ID for a plan, preserving the user's current billing interval.
 */
function getPriceIdForPlan(plan: PlanId, interval: "month" | "year" = "month"): string | null {
  const prices: Record<string, Record<string, string | undefined>> = {
    starter: {
      month: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID,
      year: process.env.NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID,
    },
    professional: {
      month: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
      year: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID,
    },
    enterprise: {
      month: process.env.NEXT_PUBLIC_STRIPE_ENT_MONTHLY_PRICE_ID,
      year: process.env.NEXT_PUBLIC_STRIPE_ENT_ANNUAL_PRICE_ID,
    },
  };
  // Fall back to monthly if annual price isn't configured
  return prices[plan]?.[interval] ?? prices[plan]?.month ?? null;
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
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Only write the cancel intent — webhook confirms the actual state
      await db
        .update(subscription)
        .set({ cancelAtPeriodEnd: true, pendingPlanChange: "free" })
        .where(eq(subscription.id, sub.id));

      return NextResponse.json({
        success: true,
        action: "downgrade_scheduled",
        message: "Your plan will change to Free at the end of the billing period.",
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      });
    }

    // ─── From here, targetPlan is a paid plan ────────────────────────────
    // Detect current billing interval to preserve it
    let stripeSub;
    try {
      stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    } catch {
      // Subscription doesn't exist in Stripe anymore — need new checkout
      const priceId = getPriceIdForPlan(targetPlan);
      if (!priceId) return NextResponse.json({ error: "Target plan not available" }, { status: 400 });
      return NextResponse.json({ action: "checkout", priceId });
    }

    if (stripeSub.status === "canceled") {
      const priceId = getPriceIdForPlan(targetPlan);
      if (!priceId) return NextResponse.json({ error: "Target plan not available" }, { status: 400 });
      return NextResponse.json({ action: "checkout", priceId });
    }

    const currentItem = stripeSub.items.data[0];
    if (!currentItem) {
      return NextResponse.json({ error: "Subscription has no items" }, { status: 500 });
    }

    // Preserve billing interval (monthly → monthly, annual → annual)
    const currentInterval = (currentItem.price?.recurring?.interval ?? "month") as "month" | "year";
    const newPriceId = getPriceIdForPlan(targetPlan, currentInterval);
    if (!newPriceId) {
      return NextResponse.json({ error: "Target plan not available" }, { status: 400 });
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
      if (msg.includes("No such customer") || msg.includes("No such subscription")) {
        await db
          .update(subscription)
          .set({ plan: "free", status: "canceled", cancelAtPeriodEnd: false, stripeSubscriptionId: null, pendingPlanChange: null })
          .where(eq(subscription.id, sub.id));
        return NextResponse.json({ action: "checkout", priceId: newPriceId });
      }
      throw stripeErr;
    }

    // ─── KEY CHANGE: Do NOT write plan/price/status to DB ─────────────
    // Only record the intent. The webhook (customer.subscription.updated)
    // will write the confirmed plan after Stripe processes payment.
    await db
      .update(subscription)
      .set({
        cancelAtPeriodEnd: false,
        pendingPlanChange: targetPlan,
      })
      .where(eq(subscription.id, sub.id));

    return NextResponse.json({
      success: true,
      action: isUpgrade ? "upgrade_pending" : "downgrade_pending",
      plan: targetPlan,
      message: isUpgrade
        ? "Upgrade processing — your plan will update momentarily."
        : "Plan change processing — your plan will update momentarily.",
    });
  } catch (error) {
    console.error("Stripe change-plan error:", error);
    const message = error instanceof Error ? error.message : "Failed to change plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
