import Stripe from "stripe";
import { priceToPlan } from "@/lib/stripe/plans";

// ─── Status mapping ────────────────────────────────────────────────────────

export const STATUS_MAP: Record<string, string> = {
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "unpaid",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
  trialing: "incomplete",
  paused: "past_due",
};

// ─── Pure helpers ──────────────────────────────────────────────────────────

/** Extract the subscription period from the first subscription item (Stripe v21+) */
export function getSubscriptionPeriod(sub: Stripe.Subscription): {
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
export function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
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
export function subscriptionDataFromStripe(stripeSub: Stripe.Subscription) {
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
  };
}
