# Stripe Webhook Configuration & Events

Complete guide for setting up and managing Stripe webhooks in CVR-MATE.

---

## Quick Setup

### 1. Create Webhook Endpoint in Stripe Dashboard

1. Navigate to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. **Endpoint URL:** `https://yourdomain.com/api/stripe/webhook`
   - Production: `https://cvr-mate.dk/api/stripe/webhook`
   - Local testing: Use `stripe listen --forward-to localhost:3000/api/stripe/webhook`
4. **API Version:** Select `2026-03-25.dahlia` (or latest)
5. **Events to subscribe to:** See [Webhook Events](#webhook-events) below
6. Click **Add endpoint**
7. Copy **Signing secret** → Add to `.env` as `STRIPE_WEBHOOK_SECRET`

### 2. Verify Setup

Test webhook delivery:
```bash
# Terminal 1: Start app
pnpm dev

# Terminal 2: Forward Stripe events to localhost
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Terminal 3: Trigger a test event
stripe trigger customer.subscription.updated
```

Expected response: `200 OK` with `{ received: true }`

---

## Webhook Events

All events are processed by `/app/api/stripe/webhook/route.ts`.

### Subscription Lifecycle

| Event | Trigger | Handler | Action |
|---|---|---|---|
| `checkout.session.completed` | New subscription created via Checkout | `handleCheckoutCompleted()` | Upsert subscription row in DB; cancel old sub if replaced |
| `customer.subscription.updated` | Plan change, interval change, status change | `handleSubscriptionUpdated()` | Update subscription row; check team downgrade |
| `customer.subscription.deleted` | Subscription canceled | `handleSubscriptionDeleted()` | Set plan=free, status=canceled; check team downgrade |

### Payment Events

| Event | Trigger | Handler | Action |
|---|---|---|---|
| `invoice.payment_succeeded` | Invoice paid successfully | `handlePaymentSucceeded()` | Sync subscription state from Stripe |
| `invoice.payment_failed` | Invoice payment attempt failed | `handlePaymentFailed()` | Sync subscription state; set status=past_due |
| `charge.failed` | Charge attempt failed (any reason) | `handleChargeFailed()` | Send "Payment Failed" email |
| `customer.source.expiring` | Card expires end of month | `handleCustomerSourceExpiring()` | Send "Card Expiring Soon" email |
| `invoice.payment_action_required` | 3D Secure or SCA verification needed | `handleInvoicePaymentActionRequired()` | Send "Action Required" email |
| `invoice.upcoming` | X days before renewal invoice | `handleInvoiceUpcoming()` | Send renewal reminder email |
| `charge.dispute.created` | Chargeback/dispute filed | `handleChargeDisputeCreated()` | Send dispute alert email |

---

## Event Details & Email Responses

### `checkout.session.completed`

**When:** New subscription created via Checkout

**Handler:** `handleCheckoutCompleted()` (line 173)

**Actions:**
- Fetch full subscription from Stripe
- Cancel any old subscription on same customer
- Upsert new subscription in `subscriptions` table
- Log: `User {userId} subscribed to {plan} (checkout completed)`

**Email:** Welcome email sent by separate flow (not in webhook)

---

### `customer.subscription.updated`

**When:** Plan upgraded/downgraded, interval changed, status changed

**Handler:** `handleSubscriptionUpdated()` (line 231)

**Actions:**
- Update `subscriptions` table with new plan/status
- Check if user is downgrading from team plan → send notification
- Log: `Subscription {subId} updated: plan={plan}, status={status}`

**Team Downgrade Logic:**
- If user owned organizations and downgrades from Enterprise → "Team features downgraded" notification
- Organization remains active; new invites blocked until re-upgrade

---

### `invoice.payment_succeeded`

**When:** Invoice payment processed successfully

**Handler:** `handlePaymentSucceeded()` (line 286)

**Actions:**
- Fetch live subscription from Stripe
- Write canonical data to DB (plan, status, period dates)
- Log: `Payment succeeded for sub {subId}, plan={plan}`

**Email:** Generic "Payment Confirmed" can be added (optional)

---

### `invoice.payment_failed`

**When:** Invoice payment attempt failed (declined, no payment method, etc.)

**Handler:** `handlePaymentFailed()` (line 308)

**Actions:**
- Fetch live subscription from Stripe
- Write canonical data (will be status=past_due if subscription in grace)
- Log: `Payment failed for subscription {subId}, status={status}`

**Entitlement Impact:**
- User enters 3-day grace period (see `lib/stripe/entitlements.ts:71`)
- After grace: features disabled, plan = free
- Webhook response: 200 (always, errors non-blocking)

---

### `charge.failed`

**When:** Any charge attempt fails (expired card, declined, insufficient funds, etc.)

**Handler:** `handleChargeFailed()` (line 331)

**Actions:**
- Find user by Stripe customer ID
- Extract failure reason from `charge.failure_message`
- Send email: "Payment Failed – Action Required"

**Email Template:** `PaymentFailedEmail`
- Subject: `Payment Failed – Action Required`
- Body: Failure reason + link to update payment method
- Links: `https://cvr-mate.dk/settings?tab=billing`

**Example Failure Reasons:**
- `"Your card has been declined"`
- `"Your card has expired"`
- `"Insufficient funds"`
- `"Card not supported"`

---

### `customer.source.expiring`

**When:** Legacy Card/Source object expires at end of month

⚠️ **Note:** Only fires for Card/Source API, NOT for PaymentMethod API. If app uses PaymentMethod, this won't trigger. Alternative: `invoice.upcoming` can include card expiry warning.

**Handler:** `handleCustomerSourceExpiring()` (line 355)

**Actions:**
- Find user by customer ID
- Extract expiry: `{card.exp_month}/{card.exp_year}`
- Send email: "Card Expiring Soon"

**Email Template:** `CardExpiringEmail`
- Subject: `Card Expiring Soon`
- Body: Expiry date + update link
- Links: `https://cvr-mate.dk/settings?tab=billing`

---

### `invoice.payment_action_required`

**When:** Payment needs additional action (3D Secure verification, SCA, etc.)

⚠️ **Note:** Invoice object in this event has no invoice ID. It's a notification-only event.

**Handler:** `handleInvoicePaymentActionRequired()` (line 383)

**Actions:**
- Find user by subscription ID
- Determine action type (defaults to "3D Secure verification")
- Send email: "Action Required: Confirm Payment"

**Email Template:** `PaymentActionRequiredEmail`
- Subject: `Action Required: Confirm Your Payment`
- Body: Explains 3D Secure/SCA + link to complete
- Links: `https://cvr-mate.dk/settings?tab=billing`

**Flow:**
1. User attempts payment
2. Stripe requires 3D Secure
3. `invoice.payment_action_required` fires
4. User gets email with link
5. User completes verification in Stripe
6. `invoice.payment_succeeded` fires (next event)

---

### `invoice.upcoming`

**When:** X days before subscription renewal (configurable in subscription settings, default ~7-10 days)

⚠️ **Note:** The invoice object has no invoice ID and is not finalized yet.

**Handler:** `handleInvoiceUpcoming()` (line 411)

**Actions:**
- Find user by subscription ID
- Extract renewal amount, currency, plan name
- Calculate days until renewal
- Send email: "Upcoming Invoice"

**Email Template:** `InvoiceUpcomingEmail`
- Subject: `Upcoming Invoice: {planName}`
- Body: Amount, currency, days until charge, link to billing
- Links: `https://cvr-mate.dk/settings?tab=billing`

**Example:**
```
Hi User,

Your next invoice for Professional will be charged in 7 days.
Amount: DKK 299.00

View Billing Details
```

---

### `charge.dispute.created`

**When:** Customer disputes charge with bank (chargeback)

**Handler:** `handleChargeDisputeCreated()` (line 439)

**Actions:**
- Find user by customer ID (via dispute metadata or charge lookup)
- Extract dispute amount and currency
- Send email: "Payment Dispute Reported"

**Email Template:** `DisputeEmail`
- Subject: `Payment Dispute Reported`
- Body: Amount, urgency to contact support
- Links: `mailto:support@cvr-mate.dk`

**Follow-up:**
- Manually review in Stripe Dashboard
- Contact user to gather evidence
- Submit response before dispute deadline

---

## Email Templates

All payment notification emails are in `lib/email/senders/payment-notifications.tsx`.

### Email Sending Flow

1. **Handler calls email function** (e.g., `sendPaymentFailedEmail()`)
2. **Mailer renders React Email template** → HTML + plain text
3. **Resend API sends email** (primary) or fallback to SendGrid/Nodemailer
4. **Email logged to DB** → `emailLog` table (status: sent/failed, messageId, error)
5. **Handler catches errors** → logs only, doesn't reject webhook

### Template IDs

All new templates added to `EmailTemplateId` type in `lib/email/types.ts`:
- `"payment_failed"`
- `"card_expiring"`
- `"payment_action_required"`
- `"invoice_upcoming"`
- `"dispute"`

### Opt-Out / Preferences

Email sending respects user preferences in `userBrand`:
- `emailNotificationsEnabled` — global toggle (blocks all transactional emails if false)
- Future: Add `billingEmailsEnabled` preference for payment-specific opt-out

Current behavior: **No opt-out** for payment/billing emails (always sent). Consider adding user preference if needed.

---

## Testing

### Test Cards

**Always succeeds:**
- `4242 4242 4242 4242`
- Any future expiry, any CVC

**Always fails:**
- `4000 0000 0000 0002`
- Any future expiry, any CVC

**Requires 3D Secure (SCA):**
- `4000 2500 3010 4010`
- Stripe will show "Complete authentication" prompt
- Trigger: `invoice.payment_action_required` → email sent

**Expires end of month:**
- Use current month/year as expiry (e.g., 05/25)
- Trigger: `customer.source.expiring` (legacy Cards only)

### Local Testing with Stripe CLI

```bash
# Terminal 1: Start app
pnpm dev

# Terminal 2: Forward Stripe webhooks
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Terminal 3: Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
stripe trigger charge.failed
stripe trigger customer.source.expiring
stripe trigger invoice.payment_action_required
stripe trigger invoice.upcoming
stripe trigger charge.dispute.created
```

Each event will call the webhook handler. Check:
- **Logs:** `pnpm dev` output should show handler logs (e.g., `[Stripe Webhook] Payment failed...`)
- **Email logs:** Check `emailLog` table in DB for sent emails
- **DB state:** Verify subscription row updated correctly

### Integration Testing

**Scenario 1: Upgrade with successful payment**
1. User upgrades plan in billing portal
2. `customer.subscription.updated` fires
3. DB updates with new plan
4. No failure emails sent ✓

**Scenario 2: Upgrade with failed payment**
1. User upgrades to new plan (immediate charge)
2. Payment fails (test card `4000 0000 0000 0002`)
3. `charge.failed` fires → payment failed email sent
4. `invoice.payment_failed` fires → subscription status=past_due
5. User in grace period for 3 days (can still use features)
6. Email includes link to update payment method ✓

**Scenario 3: 3D Secure verification required**
1. User pays with `4000 2500 3010 4010`
2. `invoice.payment_action_required` fires → email sent
3. User clicks link, completes 3D Secure in Stripe
4. `invoice.payment_succeeded` fires → subscription active ✓

**Scenario 4: Card expiring soon**
1. Card set to expire this month (legacy Card)
2. Stripe sends `customer.source.expiring` (automatic, ~30 days before)
3. Email sent: "Card Expiring Soon" ✓

**Scenario 5: Renewal reminder**
1. Subscription renewal scheduled for 7 days
2. `invoice.upcoming` fires 7 days before
3. Email sent: "Upcoming Invoice: {planName}, amount: {currency} {amount}" ✓

**Scenario 6: Dispute filed**
1. Customer disputes charge with bank
2. `charge.dispute.created` fires
3. Email sent to user: "Payment Dispute Reported"
4. Admin checks Stripe Dashboard, contacts user for evidence ✓

---

## Error Handling

### Transient vs Permanent Errors

Webhook handler distinguishes error types:

**Transient errors → 500 response**
- Database temporarily unavailable
- Network timeout
- Connection refused
- Stripe API timeout
- Deadlock

Stripe retries with exponential backoff (up to 3 days).

**Permanent errors → 200 response**
- Invalid event format
- Signature verification failed
- Unknown user ID
- Email send failure (non-blocking in handler)

Stripe stops retrying.

### Current Behavior

```typescript
if (isRetryableError(err)) {
  return NextResponse.json({ error: "Temporary error, please retry" }, { status: 500 });
}
// Otherwise 200
return NextResponse.json({ received: true });
```

All email sending errors are `try/catch` → logged but don't reject webhook.

---

## Webhook IP Allowlist

For security, Stripe requests are validated against official Stripe IP list.

**Location:** `app/api/stripe/webhook/route.ts:21` (STRIPE_WEBHOOK_IPS)

**Update:** Last updated 2025-01. Check [Stripe IP Allowlist](https://stripe.com/files/ips/ips_webhooks.txt) periodically.

**Enforcement:**
- `STRIPE_ENFORCE_IP_ALLOWLIST=true` → Block unknown IPs (reject 403)
- `STRIPE_ENFORCE_IP_ALLOWLIST=false` (default) → Warn only (signature verification still validates)

**Production:** Consider enabling strict IP allowlist.

---

## Database Tables Affected

### `subscriptions`

| Column | Updated By | Notes |
|---|---|---|
| `stripeSubscriptionId` | `handleCheckoutCompleted()` | Set once, used for lookups |
| `stripeCustomerId` | `handleCheckoutCompleted()` | Set once |
| `stripePriceId` | `handleSubscriptionUpdated()`, others | Current price ID |
| `plan` | `handleSubscriptionUpdated()`, `handlePaymentSucceeded()`, `handlePaymentFailed()` | "free", "starter", "pro", "enterprise" |
| `status` | `handleSubscriptionUpdated()`, others | "active", "past_due", "canceled", "incomplete" |
| `currentPeriodStart` | `handlePaymentSucceeded()`, others | When current period began |
| `currentPeriodEnd` | `handlePaymentSucceeded()`, others | When current period ends (renewal date) |
| `cancelAtPeriodEnd` | `handleSubscriptionDeleted()`, others | If true, sub cancels at period end |

### `emailLog`

| Column | Set By | Notes |
|---|---|---|
| `userId` | Email senders | User who received email |
| `to` | Email senders | Recipient email address |
| `subject` | Email senders | Email subject |
| `templateId` | Email senders | "payment_failed", "card_expiring", etc. |
| `provider` | Mailer | "resend" (primary) |
| `messageId` | Mailer | Resend message ID (for tracking) |
| `status` | Mailer | "sent" or "failed" |
| `error` | Mailer | Error message if status=failed |

### `notification`

| When | Handler | Data |
|---|---|---|
| Team downgrade | `checkTeamDowngrade()` | Type: "system", Title: "Team features downgraded", Link: /settings?tab=team |

---

## Monitoring & Debugging

### Logs to Watch

Check `pnpm dev` output for:
```
[Stripe Webhook] Payment failed for subscription sub_123...
[Stripe Webhook] Sent payment failed email to user@example.com
[Stripe Webhook] Subscription sub_123 updated: plan=professional, status=active
```

### Common Issues

**"Webhook signature verification failed"**
- `STRIPE_WEBHOOK_SECRET` mismatch or missing
- Verify `.env` has correct signing secret from Dashboard

**"no local row for sub {subId}"**
- Event for subscription not in DB
- Webhook arrived before checkout completed
- Subscription was deleted from DB

**Email not sent**
- Check `emailLog` table for failed entry
- Check error message in `emailLog.error`
- Verify `RESEND_API_KEY` configured
- User has `emailNotificationsEnabled: false` (check `userBrand` table)

**Payment event not triggering email**
- Verify event registered in Stripe Dashboard webhook config
- Check webhook test trigger in Stripe Dashboard
- Verify handler function is called (check logs)

---

## Deployment Checklist

Before deploying to production:

- [ ] `STRIPE_WEBHOOK_SECRET` set in production `.env`
- [ ] Webhook endpoint registered in Stripe Dashboard (production)
- [ ] All 8 events subscribed to:
  - [ ] checkout.session.completed
  - [ ] customer.subscription.updated
  - [ ] customer.subscription.deleted
  - [ ] invoice.payment_succeeded
  - [ ] invoice.payment_failed
  - [ ] charge.failed
  - [ ] customer.source.expiring
  - [ ] invoice.payment_action_required
  - [ ] invoice.upcoming
  - [ ] charge.dispute.created
- [ ] Email provider credentials active (`RESEND_API_KEY`)
- [ ] Database migrations applied (`pnpm db:migrate`)
- [ ] Webhook handler tested with test events (Stripe Dashboard → Webhooks → endpoint → Send test)
- [ ] Logs monitored for errors in first hour
- [ ] Payment cards tested (test mode, then switch to live)

---

## Code References

| File | Purpose |
|---|---|
| `app/api/stripe/webhook/route.ts` | Main webhook handler; all event cases and handlers |
| `lib/email/senders/payment-notifications.tsx` | Email templates + sending functions |
| `lib/email/mailer.ts` | Core email sending (Resend) |
| `lib/email/types.ts` | EmailTemplateId type (add new templates here) |
| `lib/stripe/entitlements.ts` | Grace period logic (3-day past_due before features disabled) |
| `lib/stripe/webhook-helpers.ts` | `subscriptionDataFromStripe()`, `getInvoiceSubscriptionId()` |
| `lib/stripe/plans.ts` | Plan limits, plan → price mapping |
| `db/schema.ts` | `subscriptions` table schema |

---

## References

- [Stripe Webhooks Docs](https://stripe.com/docs/webhooks)
- [Stripe Events Types](https://stripe.com/docs/api/events/types)
- [Stripe CLI Reference](https://stripe.com/docs/stripe-cli)
- [Stripe Test Cards](https://stripe.com/docs/testing)
- CVR-MATE: `CLAUDE.md` for architecture overview
