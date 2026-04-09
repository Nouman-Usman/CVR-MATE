# Payment Gateway Hardening — Stripe/DB Consistency Plan

## Problem Statement

The current payment system has critical data inconsistencies between the local database and Stripe. The root cause is that **API routes write plan changes to the DB before Stripe confirms payment**, and the webhook handler (the only mechanism that can correct this) **silently swallows all errors**.

---

## Root Cause Analysis

### Issue 1: CRITICAL — Plan upgraded in DB before payment
**File: `app/api/stripe/change-plan/route.ts` lines 138-148**

```
User requests upgrade → Stripe creates prorated invoice → DB updated immediately
                                                            ↑ BUG: Payment hasn't happened yet
```

The `stripe.subscriptions.update()` call changes the subscription in Stripe, which may create a prorated invoice. But the code writes `plan: resolvedPlan, status: "active"` to DB on the **next line** — before the invoice is charged. If the card declines, the DB shows the upgraded plan forever.

**Fix principle**: Never write the new plan to DB from API routes. Let the **webhook** be the only writer of plan/status/price data after Stripe confirms the state.

### Issue 2: CRITICAL — Webhook returns 200 on all errors
**File: `app/api/stripe/webhook/route.ts` lines 65-70**

```ts
catch (err) {
  console.error(...);  // Log only
}
return NextResponse.json({ received: true });  // Always 200
```

If the DB is down, if there's a query error, if anything fails — Stripe gets a 200 and never retries. The subscription state diverges permanently.

**Fix principle**: Return 500 for transient/retryable errors (DB timeout, network). Return 200 only for permanent errors (missing user) and successful processing.

### Issue 3: HIGH — Dual source of truth (plan column vs stripePriceId)
**Files: `entitlements.ts`, `change-plan/route.ts`, `subscription/route.ts`**

Three files resolve the user's plan differently:
- `entitlements.ts`: Uses `plan` column first, then overrides with `priceToPlan(stripePriceId)` if active
- `change-plan/route.ts`: Uses `priceToPlan(stripePriceId)` only, ignores `plan` column
- `subscription/route.ts` (sync): Writes both `plan` and `stripePriceId`

When these go out of sync (which they do), different parts of the app see different plans.

**Fix principle**: `stripePriceId` is the **only** source of truth. The `plan` column is a cached derivation that is ALWAYS computed from `stripePriceId`. Never write `plan` independently.

### Issue 4: HIGH — Force-sync races with webhook
**File: `app/api/stripe/subscription/route.ts` POST handler**

The frontend calls force-sync on every settings page load. If a webhook arrives mid-sync, the sync can overwrite newer webhook data with stale Stripe API data (due to network latency).

**Fix principle**: Add an `updatedAt` timestamp to the subscription table. Only update if the incoming data is newer.

### Issue 5: MEDIUM — past_due users keep full access
**File: `lib/stripe/entitlements.ts` lines 50-52**

Only `canceled` and `unpaid` statuses downgrade to free. `past_due` users (failed payment) keep their paid plan indefinitely.

**Fix principle**: Add a grace period. `past_due` users keep access for 3 days, then downgrade.

### Issue 6: MEDIUM — getPriceIdForPlan() only returns monthly prices
**File: `app/api/stripe/change-plan/route.ts` lines 17-22**

If a user is on an annual plan and changes plan, they get switched to monthly billing. The function ignores the user's current billing interval.

### Issue 7: MEDIUM — No idempotency on checkout
**File: `app/api/stripe/checkout/route.ts`**

No protection against duplicate customer creation from concurrent requests. No cleanup of `incomplete` subscriptions from abandoned checkouts.

---

## Implementation Plan

### Phase 1: Make webhook the single writer (CRITICAL)
**Estimated effort: 2-3 hours**

#### 1.1 Add `updatedAt` column to subscription table
**File: `db/app-schema.ts`**

```ts
updatedAt: timestamp("updated_at").defaultNow().notNull(),
```

This column tracks the last time the row was modified. All updates check `updatedAt` to prevent stale overwrites.

#### 1.2 Rewrite `change-plan/route.ts` — stop writing plan to DB
**File: `app/api/stripe/change-plan/route.ts`**

Current (BROKEN):
```ts
await stripe.subscriptions.update(...);  // Tell Stripe
await db.update(subscription).set({      // Write plan immediately ← BUG
  plan: resolvedPlan, status: "active", ...
});
return { success: true, plan: resolvedPlan };
```

Fixed:
```ts
await stripe.subscriptions.update(...);  // Tell Stripe
// DO NOT write plan/price/status to DB — webhook will do it
// Only write the intent so the UI can show "Change pending..."
await db.update(subscription).set({
  pendingPlanChange: targetPlan,  // New column: signals UI to show pending state
}).where(eq(subscription.id, sub.id));
return { success: true, action: "pending", message: "Plan change processing..." };
```

The webhook (`customer.subscription.updated`) will arrive within seconds and write the actual plan/price/status. The `pendingPlanChange` column lets the UI show a "processing" state.

#### 1.3 Add `pendingPlanChange` column to subscription table
**File: `db/app-schema.ts`**

```ts
pendingPlanChange: text("pending_plan_change"),  // null when no change pending
```

Cleared by the webhook handler after it writes the confirmed plan.

#### 1.4 Rewrite webhook error handling — return 500 for retryable errors
**File: `app/api/stripe/webhook/route.ts`**

```ts
try {
  switch (event.type) { ... }
} catch (err) {
  console.error(`[Stripe Webhook] Error processing ${event.type}:`, err);

  // Distinguish retryable (DB down, network) from permanent (missing user)
  const isRetryable = err instanceof Error && (
    err.message.includes("connection") ||
    err.message.includes("timeout") ||
    err.message.includes("ECONNREFUSED")
  );

  if (isRetryable) {
    return NextResponse.json({ error: "Temporary error, please retry" }, { status: 500 });
  }
  // Permanent errors: return 200 so Stripe doesn't retry forever
}
return NextResponse.json({ received: true });
```

Stripe retries 500s with exponential backoff (up to 3 days), which is exactly what we want for transient DB failures.

#### 1.5 Webhook handler clears `pendingPlanChange`
**File: `app/api/stripe/webhook/route.ts` — `handleSubscriptionUpdated`**

After updating plan/status from Stripe data, clear the pending flag:
```ts
await db.update(subscription).set({
  ...data,
  pendingPlanChange: null,  // Plan confirmed by Stripe
  updatedAt: new Date(),
}).where(eq(subscription.id, existing.id));
```

---

### Phase 2: Single source of truth for plan resolution (HIGH)
**Estimated effort: 1-2 hours**

#### 2.1 Rewrite `getUserPlan()` — derive plan exclusively from `stripePriceId`
**File: `lib/stripe/entitlements.ts`**

Current (AMBIGUOUS):
```ts
let plan = resolvePlanId(sub.plan);          // Use plan column first
if (sub.stripePriceId && sub.status === "active") {
  const priceBasedPlan = priceToPlan(sub.stripePriceId);
  if (priceBasedPlan !== "free") {
    plan = priceBasedPlan;                   // Override sometimes
  }
}
```

Fixed:
```ts
// stripePriceId is the ONLY source of truth when subscription is active
if (sub.status === "active" || sub.status === "past_due") {
  const plan = sub.stripePriceId ? priceToPlan(sub.stripePriceId) : "free";
  return { plan, status: sub.status, subscription: sub };
}

// All other statuses (canceled, unpaid, incomplete) → free
return { plan: "free", status: sub.status, subscription: sub };
```

No more `resolvePlanId(sub.plan)` fallback. No ambiguity.

#### 2.2 Ensure all webhook writes always set BOTH `plan` and `stripePriceId`

Every DB write in the webhook derives `plan` from `priceToPlan(priceId)` — this is already the case but must be enforced as an invariant. Create a helper:

```ts
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
    pendingPlanChange: null,
    updatedAt: new Date(),
  };
}
```

Use this in ALL webhook handlers (`handleCheckoutCompleted`, `handleSubscriptionUpdated`, `handlePaymentSucceeded`) to guarantee consistency.

---

### Phase 3: Fix force-sync race condition (HIGH)
**Estimated effort: 1 hour**

#### 3.1 Add staleness check to force-sync
**File: `app/api/stripe/subscription/route.ts` POST handler**

Before writing, check if the DB was updated more recently than this sync started:

```ts
const syncStartedAt = new Date();

// ... fetch from Stripe ...

// Only write if no webhook has updated since we started
await db.update(subscription)
  .set({ ...data, updatedAt: syncStartedAt })
  .where(
    and(
      eq(subscription.id, sub.id),
      // Only update if DB hasn't been written to since we started fetching
      lte(subscription.updatedAt, syncStartedAt)
    )
  );
```

This prevents the sync from overwriting newer webhook data.

#### 3.2 Reduce force-sync frequency
**File: `lib/hooks/use-subscription.ts`**

Currently force-syncs on every settings page load. Change to only sync if data is stale (>5 min):

```ts
queryFn: async () => {
  const cached = queryClient.getQueryData<SubscriptionData>(["subscription"]);
  const isStale = !cached || Date.now() - lastSyncTime > 5 * 60_000;
  if (isStale) {
    await fetch("/api/stripe/subscription", { method: "POST" }).catch(() => {});
  }
  const res = await fetch("/api/stripe/subscription");
  return res.json();
},
```

---

### Phase 4: Handle `past_due` grace period (MEDIUM)
**Estimated effort: 30 minutes**

#### 4.1 Add grace period logic to entitlements
**File: `lib/stripe/entitlements.ts`**

```ts
// past_due gets a 3-day grace period, then downgrades
if (sub.status === "past_due") {
  const pastDueSince = sub.updatedAt; // When status changed to past_due
  const gracePeriodMs = 3 * 24 * 60 * 60 * 1000; // 3 days
  const graceExpired = Date.now() - pastDueSince.getTime() > gracePeriodMs;

  if (graceExpired) {
    return { plan: "free", status: "past_due", subscription: sub };
  }
  // Within grace period — keep their plan
}
```

---

### Phase 5: Fix billing interval preservation on plan change (MEDIUM)
**Estimated effort: 30 minutes**

#### 5.1 Detect current billing interval and use matching price
**File: `app/api/stripe/change-plan/route.ts`**

```ts
function getPriceIdForPlan(plan: PlanId, interval: "month" | "year"): string | null {
  const prices: Record<string, Record<string, string | undefined>> = {
    starter:      { month: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID, year: process.env.NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID },
    professional: { month: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,     year: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID },
    enterprise:   { month: process.env.NEXT_PUBLIC_STRIPE_ENT_MONTHLY_PRICE_ID,     year: process.env.NEXT_PUBLIC_STRIPE_ENT_ANNUAL_PRICE_ID },
  };
  return prices[plan]?.[interval] ?? null;
}

// Detect current interval from Stripe subscription
const currentInterval = stripeSub.items.data[0]?.price?.recurring?.interval ?? "month";
const newPriceId = getPriceIdForPlan(targetPlan, currentInterval);
```

---

### Phase 6: Harden checkout against race conditions (MEDIUM)
**Estimated effort: 1 hour**

#### 6.1 Clean up incomplete subscriptions before new checkout
**File: `app/api/stripe/checkout/route.ts`**

Before creating a new checkout, cancel any incomplete Stripe subscriptions:

```ts
if (existingSub?.stripeSubscriptionId && existingSub.status === "incomplete") {
  try {
    await stripe.subscriptions.cancel(existingSub.stripeSubscriptionId);
  } catch { /* ignore if already gone */ }
  await db.update(subscription)
    .set({ stripeSubscriptionId: null, status: "canceled" })
    .where(eq(subscription.id, existingSub.id));
}
```

#### 6.2 Add idempotency key for customer creation

```ts
const customer = await stripe.customers.create({
  email: userEmail,
  metadata: { userId },
}, {
  idempotencyKey: `customer_create_${userId}`,
});
```

This prevents duplicate customers even if two requests run concurrently.

---

## Execution Order

```
Phase 1 (CRITICAL)  →  Phase 2 (HIGH)  →  Phase 3 (HIGH)  →  Phase 4-6 (MEDIUM)
Webhook as writer      Single source       Race condition      Polish
~2-3 hours             ~1-2 hours          ~1 hour             ~2 hours
```

**Total: ~6-8 hours**

---

## Verification Checklist

After implementation, test these scenarios:

| Scenario | Expected Behavior |
|----------|-------------------|
| Upgrade Starter → Professional | DB stays on Starter until Stripe webhook confirms. UI shows "Processing..." |
| Upgrade with declined card | DB stays on current plan. User sees error after Stripe retry fails. |
| Downgrade Professional → Free | `cancel_at_period_end = true`. Plan stays Professional until period ends. |
| Payment fails on renewal | Status → `past_due`. User keeps access for 3 days. Then → free. |
| User opens Settings while webhook fires | Force-sync doesn't overwrite newer webhook data (updatedAt check). |
| Two concurrent upgrade requests | Stripe idempotency prevents duplicate charges. DB converges via webhook. |
| Webhook handler DB timeout | Returns 500 → Stripe retries. Eventually succeeds. |
| Annual user changes plan | Keeps annual billing interval. |
| Incomplete checkout abandoned | Next checkout cancels the incomplete sub first. |

---

## Architecture Diagram — Before vs After

### Before (Current — Broken)
```
User → change-plan API → Stripe.update() → DB.update(plan=new) ← IMMEDIATE, BEFORE PAYMENT
                                         ↓
                                    Stripe webhook → DB.update() ← MAY NEVER ARRIVE (errors swallowed)
```

### After (Fixed)
```
User → change-plan API → Stripe.update() → DB.update(pendingPlanChange=new) ← INTENT ONLY
                                         ↓
                            Stripe processes payment
                                         ↓
                            Stripe webhook → DB.update(plan=new, pending=null) ← CONFIRMED BY STRIPE
                                         ↓
                            User sees updated plan (webhook is the ONLY plan writer)
```

**The golden rule: Stripe is the source of truth. The webhook is the only writer. API routes express intent, not state.**
