import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { eq } from "drizzle-orm";
import { priceToPlan, type PlanId } from "@/lib/stripe/plans";

const PLAN_HIERARCHY: Record<PlanId, number> = { free: 0, go: 1, flow: 2, enterprise: 3 };

function getPriceIdForPlan(plan: PlanId): string | null {
  if (plan === "go") return process.env.NEXT_PUBLIC_STRIPE_GO_PRICE_ID ?? null;
  if (plan === "flow") return process.env.NEXT_PUBLIC_STRIPE_FLOW_PRICE_ID ?? null;
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

    if (!targetPlan || !["free", "go", "flow"].includes(targetPlan)) {
      return NextResponse.json({ error: "Invalid target plan" }, { status: 400 });
    }

    const sub = await db.query.subscription.findFirst({
      where: eq(subscription.userId, session.user.id),
    });

    const currentPlan = (sub?.status === "active" || sub?.status === "past_due")
      ? (sub.plan as PlanId)
      : "free";

    if (currentPlan === targetPlan) {
      return NextResponse.json({ error: "Already on this plan" }, { status: 400 });
    }

    const stripe = getStripe();
    const isUpgrade = PLAN_HIERARCHY[targetPlan] > PLAN_HIERARCHY[currentPlan];

    // ─── Free → Paid: need a checkout session ────────────────────────────
    if (currentPlan === "free" || !sub?.stripeSubscriptionId) {
      const priceId = getPriceIdForPlan(targetPlan);
      if (!priceId) {
        return NextResponse.json({ error: "Target plan not available" }, { status: 400 });
      }
      // Return a signal that the frontend should initiate checkout
      return NextResponse.json({ action: "checkout", priceId });
    }

    // ─── Paid → Free: schedule cancellation at period end ────────────────
    if (targetPlan === "free") {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

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

    // ─── Paid → Paid: update subscription item's price ───────────────────
    const newPriceId = getPriceIdForPlan(targetPlan);
    if (!newPriceId) {
      return NextResponse.json({ error: "Target plan not available" }, { status: 400 });
    }

    // Get the current subscription from Stripe to find the item ID
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    const currentItem = stripeSub.items.data[0];
    if (!currentItem) {
      return NextResponse.json({ error: "Subscription has no items" }, { status: 500 });
    }

    // Upgrade: immediate with proration. Downgrade: immediate, no proration.
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: currentItem.id, price: newPriceId }],
      proration_behavior: isUpgrade ? "create_prorations" : "none",
    });

    // Update local DB immediately
    const resolvedPlan = priceToPlan(newPriceId);
    await db
      .update(subscription)
      .set({
        stripePriceId: newPriceId,
        plan: resolvedPlan,
        cancelAtPeriodEnd: false,
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
