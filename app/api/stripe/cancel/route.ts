import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sub = await db.query.subscription.findFirst({
      where: eq(subscription.userId, session.user.id),
    });

    if (!sub?.stripeSubscriptionId || sub.status !== "active") {
      return NextResponse.json(
        { error: "No active subscription to cancel" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update local DB immediately so the UI reflects the change
    await db
      .update(subscription)
      .set({ cancelAtPeriodEnd: true })
      .where(eq(subscription.id, sub.id));

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Stripe cancel error:", error);
    const message = error instanceof Error ? error.message : "Failed to cancel subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
