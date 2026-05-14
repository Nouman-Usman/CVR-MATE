import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { subscription, user } from "@/db/schema";
import { member } from "@/db/auth-schema";
import { notification } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PLAN_LIMITS } from "@/lib/stripe/plans";
import {
  STATUS_MAP,
  getInvoiceSubscriptionId,
  subscriptionDataFromStripe,
} from "@/lib/stripe/webhook-helpers";
import {
  sendPaymentFailedEmail,
  sendCardExpiringEmail,
  sendPaymentActionRequiredEmail,
  sendInvoiceUpcomingEmail,
  sendDisputeEmail,
} from "@/lib/email/senders/payment-notifications";

export const runtime = "nodejs";

// ─── Stripe IP allowlist ────────────────────────────────────────────────────
// Source: https://stripe.com/files/ips/ips_webhooks.txt (updated 2025-01)
// Set STRIPE_ENFORCE_IP_ALLOWLIST=true to block unknown IPs (default: warn only).
const STRIPE_WEBHOOK_IPS = new Set([
  "3.18.12.63",
  "3.130.192.231",
  "13.235.14.237",
  "13.235.122.149",
  "18.211.135.69",
  "35.154.171.200",
  "52.15.183.38",
  "54.88.130.119",
  "54.88.130.237",
  "54.187.174.169",
  "54.187.205.235",
  "54.187.216.72",
]);

function checkStripeIp(req: NextRequest): void {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip || STRIPE_WEBHOOK_IPS.has(ip)) return;

  if (process.env.STRIPE_ENFORCE_IP_ALLOWLIST === "true") {
    throw new Error(`Blocked webhook from unknown IP: ${ip}`);
  } else {
    // Warn only — signature verification still protects us
    console.warn(`[Stripe Webhook] Request from non-allowlisted IP: ${ip}`);
  }
}

/**
 * Check if a user is being downgraded from a plan that allowed teams to one that
 * doesn't. If they own organizations, send a warning notification. The org is NOT
 * auto-deleted — the user must act (dissolve team or re-upgrade).
 */
async function checkTeamDowngrade(userId: string, newPlan: string) {
  const newLimits = PLAN_LIMITS[newPlan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;
  if (newLimits.teamFeatures) return; // Still has team features — nothing to do

  // Check if user owns any orgs
  const ownedOrgs = await db.query.member.findMany({
    where: eq(member.userId, userId),
  });
  const ownerOrgs = ownedOrgs.filter((m) => m.role === "owner");
  if (ownerOrgs.length === 0) return;

  // User owns orgs but is losing team features — send warning notification
  await db.insert(notification).values({
    userId,
    type: "system",
    title: "Team features downgraded",
    message:
      "Your plan no longer includes team features. Your organization is still active, " +
      "but new invitations are blocked. Upgrade to Enterprise or dissolve your team in Settings.",
    priority: "high",
    link: "/settings?tab=team",
  });

  console.log(`[Stripe Webhook] User ${userId} downgraded with ${ownerOrgs.length} org(s) — warning sent`);
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
  try {
    checkStripeIp(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Forbidden";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

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

      case "charge.failed":
        await handleChargeFailed(event.data.object as Stripe.Charge);
        break;

      case "customer.source.expiring":
        await handleCustomerSourceExpiring(event.data.object as Stripe.Card);
        break;

      case "invoice.payment_action_required":
        await handleInvoicePaymentActionRequired(event.data.object as Stripe.Invoice);
        break;

      case "invoice.upcoming":
        await handleInvoiceUpcoming(event.data.object as Stripe.Invoice);
        break;

      case "charge.dispute.created":
        await handleChargeDisputeCreated(event.data.object as Stripe.Dispute);
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

  // Check for team downgrade (async, non-blocking)
  checkTeamDowngrade(existing.userId, data.plan).catch((err) =>
    console.error("[Stripe Webhook] Team downgrade check failed:", err)
  );
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

  // Check for team downgrade
  checkTeamDowngrade(existing.userId, "free").catch((err) =>
    console.error("[Stripe Webhook] Team downgrade check failed:", err)
  );
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

  // Fetch live sub and write canonical data — same pattern as handlePaymentSucceeded.
  // Avoids leaving stale plan data when an upgrade invoice fails to charge.
  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(subId);
  const data = subscriptionDataFromStripe(stripeSub);

  await db
    .update(subscription)
    .set(data)
    .where(eq(subscription.id, existing.id));

  console.log(`[Stripe Webhook] Payment failed for subscription ${subId}, status=${data.status}`);
}

/**
 * Handle charge.failed — send email to user about failed payment.
 */
async function handleChargeFailed(charge: Stripe.Charge) {
  const customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
  if (!customerId) return;

  // Find user by Stripe customer ID
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.stripeCustomerId, customerId),
  });
  if (!sub) return;

  const userRow = await db.query.user.findFirst({
    where: eq(user.id, sub.userId),
  });
  if (!userRow) return;

  const failureReason = charge.failure_message || "Unknown reason";

  try {
    await sendPaymentFailedEmail({
      to: userRow.email,
      userName: userRow.name || "User",
      userId: sub.userId,
      failureReason,
    });
    console.log(`[Stripe Webhook] Sent payment failed email to ${userRow.email}`);
  } catch (err) {
    console.error("[Stripe Webhook] Failed to send payment failed email:", err);
  }
}

/**
 * Handle customer.source.expiring — send card expiration warning email.
 * Note: Only fires for legacy Card/Source objects, not PaymentMethod API.
 */
async function handleCustomerSourceExpiring(card: Stripe.Card) {
  const customerId = typeof card.customer === "string" ? card.customer : card.customer?.id;
  if (!customerId) return;

  // Find user by Stripe customer ID
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.stripeCustomerId, customerId),
  });
  if (!sub) return;

  const userRow = await db.query.user.findFirst({
    where: eq(user.id, sub.userId),
  });
  if (!userRow) return;

  const expiryDate = `${card.exp_month}/${card.exp_year}`;

  try {
    await sendCardExpiringEmail({
      to: userRow.email,
      userName: userRow.name || "User",
      userId: sub.userId,
      expiryDate,
    });
    console.log(`[Stripe Webhook] Sent card expiring email to ${userRow.email}`);
  } catch (err) {
    console.error("[Stripe Webhook] Failed to send card expiring email:", err);
  }
}

/**
 * Handle invoice.payment_action_required — send email for 3D Secure / SCA verification.
 */
async function handleInvoicePaymentActionRequired(invoice: Stripe.Invoice) {
  const subId = getInvoiceSubscriptionId(invoice);
  if (!subId) return;

  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.stripeSubscriptionId, subId),
  });
  if (!sub) return;

  const userRow = await db.query.user.findFirst({
    where: eq(user.id, sub.userId),
  });
  if (!userRow) return;

  // Determine action type from last payment charge attempt
  const actionType =
    invoice.last_payment_error?.payment_method?.type === "card" ? "3D Secure verification" : "Payment confirmation";

  try {
    await sendPaymentActionRequiredEmail({
      to: userRow.email,
      userName: userRow.name || "User",
      userId: sub.userId,
      actionType,
    });
    console.log(`[Stripe Webhook] Sent payment action required email to ${userRow.email}`);
  } catch (err) {
    console.error("[Stripe Webhook] Failed to send payment action required email:", err);
  }
}

/**
 * Handle invoice.upcoming — send renewal reminder email.
 * Note: The invoice object will not have an invoice ID in this event.
 */
async function handleInvoiceUpcoming(invoice: Stripe.Invoice) {
  const subId = getInvoiceSubscriptionId(invoice);
  if (!subId) return;

  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.stripeSubscriptionId, subId),
  });
  if (!sub) return;

  const userRow = await db.query.user.findFirst({
    where: eq(user.id, sub.userId),
  });
  if (!userRow) return;

  // Calculate days until invoice (usually 7-10 days before renewal)
  const nextPeriodStart = invoice.lines?.data?.[0]?.period?.start;
  const daysUntil = nextPeriodStart
    ? Math.ceil((nextPeriodStart * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
    : 7;

  const amount = invoice.amount_due / 100;
  const currency = invoice.currency?.toUpperCase() ?? "USD";
  const planName = sub.plan?.toUpperCase() ?? "Plan";

  try {
    await sendInvoiceUpcomingEmail({
      to: userRow.email,
      userName: userRow.name || "User",
      userId: sub.userId,
      amount,
      currency,
      daysUntil: Math.max(daysUntil, 1),
      planName,
    });
    console.log(`[Stripe Webhook] Sent invoice upcoming email to ${userRow.email}`);
  } catch (err) {
    console.error("[Stripe Webhook] Failed to send invoice upcoming email:", err);
  }
}

/**
 * Handle charge.dispute.created — send chargeback/dispute alert email.
 */
async function handleChargeDisputeCreated(dispute: Stripe.Dispute) {
  const charge = dispute.charge;
  const chargeId = typeof charge === "string" ? charge : charge?.id;
  if (!chargeId) return;

  // Get customer from dispute metadata or fetch charge
  let customerId: string | undefined;
  if (dispute.metadata?.stripe_customer_id) {
    customerId = dispute.metadata.stripe_customer_id;
  } else {
    // Try to get customer from charge (may not be available in dispute object)
    const stripe = getStripe();
    try {
      const chargeObj = await stripe.charges.retrieve(chargeId);
      customerId = typeof chargeObj.customer === "string" ? chargeObj.customer : chargeObj.customer?.id;
    } catch {
      console.warn(`[Stripe Webhook] Could not retrieve charge ${chargeId} for dispute`);
      return;
    }
  }

  if (!customerId) return;

  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.stripeCustomerId, customerId),
  });
  if (!sub) return;

  const userRow = await db.query.user.findFirst({
    where: eq(user.id, sub.userId),
  });
  if (!userRow) return;

  const amount = dispute.amount / 100;
  const currency = dispute.currency?.toUpperCase() ?? "USD";

  try {
    await sendDisputeEmail({
      to: userRow.email,
      userName: userRow.name || "User",
      userId: sub.userId,
      amount,
      currency,
    });
    console.log(`[Stripe Webhook] Sent dispute alert email to ${userRow.email}`);
  } catch (err) {
    console.error("[Stripe Webhook] Failed to send dispute email:", err);
  }
}
