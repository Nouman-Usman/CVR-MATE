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

    if (!sub?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 400 }
      );
    }

    if (!sub.cancelAtPeriodEnd) {
      return NextResponse.json(
        { error: "Subscription is not scheduled for cancellation" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // Update local DB immediately
    await db
      .update(subscription)
      .set({ cancelAtPeriodEnd: false })
      .where(eq(subscription.id, sub.id));

    return NextResponse.json({ success: true, cancelAtPeriodEnd: false });
  } catch (error) {
    console.error("Stripe resume error:", error);
    const message = error instanceof Error ? error.message : "Failed to resume subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
