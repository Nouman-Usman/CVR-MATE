import "server-only";

import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { eq } from "drizzle-orm";
import { subscriptionDataFromStripe } from "@/lib/stripe/webhook-helpers";
import type { PlanId } from "@/lib/stripe/plans";

const TRIAL_DAYS = 14;

/** Monthly price per plan. Public env vars (same ones the checkout route validates). */
const PRICE_BY_PLAN: Partial<Record<PlanId, string | undefined>> = {
  starter: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID,
  professional: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
  enterprise: process.env.NEXT_PUBLIC_STRIPE_ENT_MONTHLY_PRICE_ID,
};

/**
 * Grant a card-free 14-day trial subscription for a chat-landing signup.
 *
 * Runs server-side immediately after the account is created, so the trial is
 * live without a Stripe Checkout redirect — which mandatory email verification
 * would otherwise block (checkout needs a session the user doesn't have yet).
 *
 * The subscription is created with NO payment method: `trial_settings` tells
 * Stripe to simply cancel at trial end if the user never adds a card, so it's a
 * true "no charge today" trial. The DB row is written here (not left to the
 * webhook) because webhooks match by `stripeSubscriptionId` and would skip a
 * subscription they've never seen a local row for.
 *
 * Best-effort: the caller catches any throw so a Stripe hiccup never fails the
 * signup itself — the account still exists and the user can start a trial from
 * settings later.
 */
export async function grantChatLandingTrial(params: {
  userId: string;
  email: string;
  plan: string;
}): Promise<void> {
  const priceId = PRICE_BY_PLAN[params.plan as PlanId];
  if (!priceId) {
    console.warn(
      `[chat-landing trial] no monthly price configured for plan "${params.plan}", skipping trial grant`
    );
    return;
  }

  // Never double-grant: if this user already has a subscription in Stripe, stop.
  const existing = await db.query.subscription.findFirst({
    where: eq(subscription.userId, params.userId),
    columns: { id: true, stripeSubscriptionId: true },
  });
  if (existing?.stripeSubscriptionId) return;

  const stripe = getStripe();

  const customer = await stripe.customers.create(
    { email: params.email, metadata: { userId: params.userId } },
    { idempotencyKey: `customer_create_${params.userId}` }
  );

  const sub = await stripe.subscriptions.create(
    {
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: TRIAL_DAYS,
      // No card collected up front — cancel at trial end if none is added.
      trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
      metadata: { userId: params.userId, source: "chat-landing" },
    },
    { idempotencyKey: `chat_landing_trial_${params.userId}` }
  );

  const data = subscriptionDataFromStripe(sub);

  if (existing) {
    await db
      .update(subscription)
      .set({ stripeCustomerId: customer.id, stripeSubscriptionId: sub.id, ...data })
      .where(eq(subscription.id, existing.id));
  } else {
    await db.insert(subscription).values({
      userId: params.userId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: sub.id,
      ...data,
    });
  }
}
