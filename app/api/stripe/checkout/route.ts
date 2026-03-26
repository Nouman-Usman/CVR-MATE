import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { priceId } = body;

    if (!priceId || typeof priceId !== "string") {
      return NextResponse.json(
        { error: "priceId is required" },
        { status: 400 }
      );
    }

    // Validate priceId is one of our known prices
    const validPriceIds = [
      process.env.NEXT_PUBLIC_STRIPE_GO_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_FLOW_PRICE_ID,
    ].filter(Boolean);

    if (!validPriceIds.includes(priceId)) {
      return NextResponse.json(
        { error: "Invalid price ID" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const userId = session.user.id;
    const userEmail = session.user.email;

    // Check if user already has a Stripe customer
    const existingSub = await db.query.subscription.findFirst({
      where: eq(subscription.userId, userId),
    });

    let stripeCustomerId = existingSub?.stripeCustomerId;

    // If they already have an active subscription, redirect to portal instead
    if (existingSub?.stripeSubscriptionId && existingSub.status === "active") {
      return NextResponse.json(
        { error: "You already have an active subscription. Use the billing portal to change plans." },
        { status: 409 }
      );
    }

    // Create or reuse Stripe customer
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;

      // Persist the customer ID early so we don't create duplicates on retry
      if (existingSub) {
        await db
          .update(subscription)
          .set({ stripeCustomerId })
          .where(eq(subscription.userId, userId));
      } else {
        await db.insert(subscription).values({
          userId,
          stripeCustomerId,
          plan: "free",
          status: "incomplete",
        });
      }
    }

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000";

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings?checkout=success`,
      cancel_url: `${origin}/settings?checkout=canceled`,
      metadata: { userId },
      subscription_data: {
        metadata: { userId },
      },
      allow_promotion_codes: true,
      currency: "dkk",
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    const message = error instanceof Error ? error.message : "Failed to create checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
