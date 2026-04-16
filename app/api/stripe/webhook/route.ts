import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { eq } from "drizzle-orm";
import { priceToPlan } from "@/lib/stripe/plans";

export const runtime = "nodejs";

// ─── Status mapping ────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "unpaid",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
  trialing: "incomplete",
  paused: "past_due",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract the subscription period from the first subscription item (Stripe v21+) */
function getSubscriptionPeriod(sub: Stripe.Subscription): {
  start: Date | null;
  end: Date | null;
} {
  const item = sub.items?.data?.[0];
  if (item?.current_period_start && item?.current_period_end) {
    return {
      start: new Date(item.current_period_start * 1000),
      end: new Date(item.current_period_end * 1000),
    };
  }
  return {
    start: sub.start_date ? new Date(sub.start_date * 1000) : null,
    end: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
  };
}

/** Extract subscription ID from an invoice (Stripe v21 nests it under parent) */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  // Try the v21 nested path first
  const parent = invoice.parent;
  if (parent?.subscription_details?.subscription) {
    const sub = parent.subscription_details.subscription;
    return typeof sub === "string" ? sub : sub.id;
  }
  // Fallback to direct field (older API versions)
  if ("subscription" in invoice && invoice.subscription) {
    const sub = invoice.subscription;
    return typeof sub === "string" ? sub : (sub as { id: string }).id;
  }
  return null;
}

/**
 * Build a canonical DB update payload from a Stripe subscription.
 * This is the ONLY function that derives plan/status/price from Stripe data.
 * Used by ALL webhook handlers to guarantee consistency.
 */
function subscriptionDataFromStripe(stripeSub: Stripe.Subscription) {
  const priceId = stripeSub.items.data[0]?.price?.id ?? null;
  const plan = stripeSub.status === "canceled" ? "free" : priceToPlan(priceId);
  const period = getSubscriptionPeriod(stripeSub);
  const status = STATUS_MAP[stripeSub.status] ?? stripeSub.status;

  return {
    stripePriceId: priceId,
    plan,
    status,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    // pendingPlanChange is deprecated (cancel-first flow has no inline plan swaps)
  };
}

/**
 * Determine if an error is transient (Stripe should retry) vs permanent (don't retry).
 */
function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("connection") ||
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed") ||
    msg.includes("socket hang up") ||
    msg.includes("too many connections") ||
    msg.includes("deadlock")
  );
}

// ─── Main Handler ───────────────────────────────────────────────────────────

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
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, err);

    // Transient errors → 500 so Stripe retries (exponential backoff, up to 3 days)
    // Permanent errors → 200 so Stripe stops retrying
    if (isRetryableError(err)) {
      return NextResponse.json(
        { error: "Temporary error, please retry" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
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
  const data = subscriptionDataFromStripe(stripeSub);

  // Upsert — and cancel any old subscription that's being replaced
  const existing = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
  });

  // If user already had a different subscription (cancel-first flow: they canceled
  // their old plan and checked out a new one), immediately cancel the old one in
  // Stripe to prevent double-billing and entitlement ambiguity.
  if (existing?.stripeSubscriptionId && existing.stripeSubscriptionId !== stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(existing.stripeSubscriptionId);
      console.log(`[Stripe Webhook] Canceled old sub ${existing.stripeSubscriptionId} (replaced by ${stripeSubscriptionId})`);
    } catch {
      // Already canceled or doesn't exist — safe to ignore
    }
  }

  const fullData = {
    stripeCustomerId,
    stripeSubscriptionId,
    ...data,
  };

  if (existing) {
    await db.update(subscription).set(fullData).where(eq(subscription.userId, userId));
  } else {
    await db.insert(subscription).values({ userId, ...fullData });
  }

  console.log(`[Stripe Webhook] User ${userId} subscribed to ${data.plan} (checkout completed)`);
}

async function handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
  // Only match by exact subscription ID — no customer ID fallback.
  // This prevents stale events from an old (canceled) subscription from
  // overwriting the data of a newer subscription on the same customer.
  const existing = await db.query.subscription.findFirst({
    where: eq(subscription.stripeSubscriptionId, stripeSub.id),
  });

  if (!existing) {
    console.warn(`[Stripe Webhook] subscription.updated: no local row for sub ${stripeSub.id}`);
    return;
  }

  const data = subscriptionDataFromStripe(stripeSub);

  await db
    .update(subscription)
    .set(data)
    .where(eq(subscription.id, existing.id));

  console.log(`[Stripe Webhook] Subscription ${stripeSub.id} updated: plan=${data.plan}, status=${data.status}`);
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
    .set({
      plan: "free",
      status: "canceled",
      cancelAtPeriodEnd: false,
    })
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

  // Fetch full subscription from Stripe and write canonical data
  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(subId);
  const data = subscriptionDataFromStripe(stripeSub);

  await db
    .update(subscription)
    .set(data)
    .where(eq(subscription.id, existing.id));

  console.log(`[Stripe Webhook] Payment succeeded for sub ${subId}, plan=${data.plan}`);
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
    .set({
      status: "past_due",
    })
    .where(eq(subscription.id, existing.id));

  console.log(`[Stripe Webhook] Payment failed for subscription ${subId}, marked as past_due`);
}
