import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { eq } from "drizzle-orm";
import { priceToPlan } from "@/lib/stripe/plans";

export const runtime = "nodejs";

/**
 * Stripe webhook handler.
 * Verifies the signature, then processes subscription lifecycle events.
 * Always returns 200 to prevent Stripe from retrying on app-level errors.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe Webhook] Signature verification failed:", msg);
    return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        break;
    }
  } catch (err) {
    // Log but return 200 to prevent Stripe retries on our bugs
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, err);
  }

  return NextResponse.json({ received: true });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract the subscription period from the first subscription item */
function getSubscriptionPeriod(sub: Stripe.Subscription): {
  start: Date | null;
  end: Date | null;
} {
  // Stripe v21 (dahlia): current_period_start/end moved to item level
  const item = sub.items?.data?.[0];
  if (item?.current_period_start && item?.current_period_end) {
    return {
      start: new Date(item.current_period_start * 1000),
      end: new Date(item.current_period_end * 1000),
    };
  }
  // Fallback to start_date + billing_cycle_anchor
  return {
    start: sub.start_date ? new Date(sub.start_date * 1000) : null,
    end: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
  };
}

/** Extract subscription ID from an invoice (Stripe v21 nests it under parent) */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (parent?.subscription_details?.subscription) {
    const sub = parent.subscription_details.subscription;
    return typeof sub === "string" ? sub : sub.id;
  }
  return null;
}

// ─── Event Handlers ─────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;

  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("[Stripe Webhook] checkout.session.completed missing userId in metadata");
    return;
  }

  const stripeSubscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id;
  const stripeCustomerId = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id;

  if (!stripeSubscriptionId || !stripeCustomerId) {
    console.error("[Stripe Webhook] checkout.session.completed missing subscription or customer ID");
    return;
  }

  // Fetch the full subscription to get price and period info
  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const priceId = stripeSub.items.data[0]?.price?.id ?? null;
  const plan = priceToPlan(priceId);
  const period = getSubscriptionPeriod(stripeSub);

  // Upsert
  const existing = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
  });

  const data = {
    stripeCustomerId,
    stripeSubscriptionId,
    stripePriceId: priceId,
    plan,
    status: "active",
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
  };

  if (existing) {
    await db.update(subscription).set(data).where(eq(subscription.userId, userId));
  } else {
    await db.insert(subscription).values({ userId, ...data });
  }

  console.log(`[Stripe Webhook] User ${userId} subscribed to ${plan}`);
}

async function handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
  const stripeCustomerId = typeof stripeSub.customer === "string"
    ? stripeSub.customer
    : stripeSub.customer?.id;

  // Find by subscription ID first, then customer ID
  let existing = await db.query.subscription.findFirst({
    where: eq(subscription.stripeSubscriptionId, stripeSub.id),
  });
  if (!existing && stripeCustomerId) {
    existing = await db.query.subscription.findFirst({
      where: eq(subscription.stripeCustomerId, stripeCustomerId),
    });
  }

  if (!existing) {
    console.warn(`[Stripe Webhook] subscription.updated: no local row for sub ${stripeSub.id}`);
    return;
  }

  const priceId = stripeSub.items.data[0]?.price?.id ?? null;
  const plan = priceToPlan(priceId);
  const period = getSubscriptionPeriod(stripeSub);

  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "unpaid",
    incomplete: "incomplete",
    incomplete_expired: "canceled",
    trialing: "active",
    paused: "past_due",
  };

  await db
    .update(subscription)
    .set({
      stripePriceId: priceId,
      plan,
      status: statusMap[stripeSub.status] ?? stripeSub.status,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    })
    .where(eq(subscription.id, existing.id));

  console.log(`[Stripe Webhook] Subscription ${stripeSub.id} updated: plan=${plan}, status=${stripeSub.status}`);
}

async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
  const existing = await db.query.subscription.findFirst({
    where: eq(subscription.stripeSubscriptionId, stripeSub.id),
  });

  if (!existing) {
    console.warn(`[Stripe Webhook] subscription.deleted: no local row for sub ${stripeSub.id}`);
    return;
  }

  await db
    .update(subscription)
    .set({ plan: "free", status: "canceled", cancelAtPeriodEnd: false })
    .where(eq(subscription.id, existing.id));

  console.log(`[Stripe Webhook] Subscription ${stripeSub.id} deleted, user downgraded to free`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subId = getInvoiceSubscriptionId(invoice);
  if (!subId) return;

  const existing = await db.query.subscription.findFirst({
    where: eq(subscription.stripeSubscriptionId, subId),
  });
  if (!existing) return;

  // Refresh from Stripe
  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(subId);
  const period = getSubscriptionPeriod(stripeSub);

  await db
    .update(subscription)
    .set({
      status: "active",
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
    })
    .where(eq(subscription.id, existing.id));
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subId = getInvoiceSubscriptionId(invoice);
  if (!subId) return;

  const existing = await db.query.subscription.findFirst({
    where: eq(subscription.stripeSubscriptionId, subId),
  });
  if (!existing) return;

  await db
    .update(subscription)
    .set({ status: "past_due" })
    .where(eq(subscription.id, existing.id));

  console.log(`[Stripe Webhook] Payment failed for subscription ${subId}, marked as past_due`);
}
