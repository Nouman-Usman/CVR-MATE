import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: "Application base URL is not configured" },
        { status: 500 }
      );
    }
    const appUrl = baseUrl.replace(/\/$/, "");

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sub = await db.query.subscription.findFirst({
      where: eq(subscription.userId, session.user.id),
    });

    if (!sub?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. You are on the Free plan." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${appUrl}/settings?tab=subscription`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Stripe portal error:", error);
    const message = error instanceof Error ? error.message : "Failed to create portal session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
