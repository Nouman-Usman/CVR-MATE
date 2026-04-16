# Email Infrastructure — SendGrid + Gmail Fallback

## Context

CVR-MATE needs a transactional email system for three use cases:
1. **Auth emails** — verification and password reset (Better Auth hooks are ready but no sender is wired)
2. **Team management** — invitation emails when a user is added to an organization (Better Auth org plugin)
3. **Notification emails** — daily lead trigger digests and weekly summaries (user-opt-in, async via QStash)

The design mirrors the existing `lib/crm/` architecture: a provider interface with two concrete implementations (SendGrid primary, Gmail/SMTP fallback) behind a single `sendEmail()` function. QStash is already installed and proven; notification emails go through it. All sends are logged to a new `emailLog` DB table.

---

## Package Installs

```bash
pnpm add @sendgrid/mail nodemailer @react-email/components react-email
pnpm add -D @types/nodemailer
```

---

## File Structure

```
lib/email/
  types.ts                    ← EmailProvider interface + shared payload types
  mailer.ts                   ← sendEmail() with fallback chain + emailLog write
  queue.ts                    ← queueNotificationEmail() via QStash
  providers/
    sendgrid.ts               ← @sendgrid/mail implementation
    gmail.ts                  ← nodemailer SMTP / OAuth2 implementation
  senders/
    verification.ts           ← thin wrapper: template + subject + templateId
    reset-password.ts
    welcome.ts
    team-invitation.ts
    daily-lead-update.ts
    weekly-summary.ts
  templates/
    verification.tsx          ← React Email component
    reset-password.tsx
    welcome.tsx
    team-invitation.tsx
    daily-lead-update.tsx
    weekly-summary.tsx

app/api/email/
  webhook/route.ts            ← SendGrid delivery/bounce webhook (POST, nodejs runtime)
  notify/route.ts             ← QStash receiver for async notification emails (POST, nodejs runtime)
```

---

## Interface (`lib/email/types.ts`)

```typescript
export type EmailProvider = "sendgrid" | "gmail";

export type EmailTemplateId =
  | "email_verification"
  | "password_reset"
  | "welcome"
  | "team_invitation"
  | "daily_lead_update"
  | "weekly_summary";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  templateId?: EmailTemplateId;   // stored in emailLog
  userId?: string;                // stored in emailLog
}

export interface SendEmailResult {
  provider: EmailProvider;
  messageId?: string;
}

export interface EmailProviderClient {
  send(opts: SendEmailOptions): Promise<SendEmailResult>;
}

// QStash payload for /api/email/notify
export interface EmailQueuePayload {
  templateId: "daily_lead_update" | "weekly_summary";
  userId: string;
  data: DailyLeadUpdateData | WeeklySummaryData;
}

export interface DailyLeadUpdateData {
  triggerName: string;
  triggerId: string;
  matchCount: number;
  companies: { vat: string; name: string; city: string; industry: string }[];
}

export interface WeeklySummaryData {
  periodStart: string;  // ISO date
  periodEnd: string;
  totalLeads: number;
  topTriggers: { name: string; count: number }[];
  savedCompaniesCount: number;
}

export interface SendGridWebhookEvent {
  email: string;
  timestamp: number;
  event: "delivered" | "bounce" | "dropped" | "deferred" | "open" | "click" | "unsubscribe" | "spamreport";
  sg_message_id?: string;
  reason?: string;
  status?: string;
}
```

---

## Fallback Mailer (`lib/email/mailer.ts`)

```typescript
import "server-only";
import { render } from "@react-email/render";

export async function sendEmail(
  template: React.ReactElement,
  opts: Omit<SendEmailOptions, "html" | "text">
): Promise<SendEmailResult> {
  const html = await render(template);
  const text = await render(template, { plainText: true });
  const fullOpts = { ...opts, html, text };

  let result: SendEmailResult | null = null;
  let lastError: unknown;

  // 1. Try SendGrid
  if (process.env.SENDGRID_API_KEY) {
    try { result = await createSendGridProvider().send(fullOpts); }
    catch (err) { lastError = err; console.error("[email] SendGrid failed:", err); }
  }

  // 2. Fall back to Gmail/SMTP
  if (!result && (process.env.SMTP_USER || process.env.GMAIL_OAUTH2_CLIENT_ID)) {
    try { result = await createGmailProvider().send(fullOpts); }
    catch (err) { lastError = err; console.error("[email] Gmail fallback failed:", err); }
  }

  if (!result) {
    await writeEmailLog(fullOpts, null, null, "failed", String(lastError));
    throw new Error(`[email] All providers failed: ${lastError}`);
  }

  await writeEmailLog(fullOpts, result.provider, result.messageId, "sent", null);
  return result;
}
```

`writeEmailLog` inserts into `emailLog` table — always called regardless of which provider succeeded or failed.

---

## DB Schema Additions (`db/app-schema.ts`)

### New table: `emailLog`

```typescript
export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    templateId: text("template_id"),
    provider: text("provider"),               // 'sendgrid' | 'gmail' | null on failure
    messageId: text("message_id"),            // provider message ID (used by webhook)
    status: text("status").default("sent").notNull(),
    deliveryStatus: text("delivery_status"),  // updated by SendGrid webhook
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    error: text("error"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("email_log_user_idx").on(t.userId),
    index("email_log_message_id_idx").on(t.messageId),
    index("email_log_created_idx").on(t.createdAt),
  ]
);
```

### Add 4 columns to `userBrand` pgTable definition

```typescript
emailNotificationsEnabled: boolean("email_notifications_enabled").default(true).notNull(),
dailyLeadEmails: boolean("daily_lead_emails").default(true).notNull(),
weeklySummaryEmails: boolean("weekly_summary_emails").default(true).notNull(),
emailNotificationHour: integer("email_notification_hour").default(8).notNull(),
```

Add `emailLogRelations` and add `emailLogs: many(emailLog)` to `userRelations`.

Run: `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`

---

## Better Auth Wiring (`lib/auth.ts`)

Import the sender wrappers from `lib/email/senders/` and wire all 4 Better Auth callbacks:

```typescript
import { sendVerificationEmail } from "@/lib/email/senders/verification";
import { sendPasswordResetEmail } from "@/lib/email/senders/reset-password";
import { sendWelcomeEmail } from "@/lib/email/senders/welcome";
import { sendTeamInvitationEmail } from "@/lib/email/senders/team-invitation";

export const auth = betterAuth({
  // ...existing config...
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ to: user.email, userName: user.name, verificationUrl: url, userId: user.id });
    },
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, userName: user.name, resetUrl: url, userId: user.id });
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await sendWelcomeEmail({ to: user.email, userName: user.name, userId: user.id });
        },
      },
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      sendInvitationEmail: async ({ invitation, inviter, organization, url }) => {
        await sendTeamInvitationEmail({
          to: invitation.email,
          inviterName: inviter.name,
          organizationName: organization.name,
          inviteUrl: url,
          role: invitation.role,
          expiresAt: invitation.expiresAt.toISOString(),
        });
      },
    }),
  ],
});
```

---

## QStash Integration

### `lib/email/queue.ts`

```typescript
import { Client } from "@upstash/qstash";

export async function queueNotificationEmail(payload: EmailQueuePayload): Promise<void> {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "https://cvr-mate.vercel.app";
  const client = new Client({ token: process.env.QSTASH_TOKEN! });
  await client.publishJSON({
    url: `${baseUrl}/api/email/notify`,
    body: payload,
    retries: 3,
  });
}
```

### `app/api/email/notify/route.ts` (QStash receiver)

```typescript
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await verifyQStashRequest(req))) return unauthorized();

  const { templateId, userId, data }: EmailQueuePayload = await req.json();

  // Fetch user + prefs, honor opt-out, then call the appropriate sender wrapper
  // Returns { skipped: true, reason: "user_opted_out" } if emailNotificationsEnabled = false
  //         or the specific template flag is false
}
```

### Integration in `app/api/cron/triggers/route.ts`

After `createNotification(...)`, add:

```typescript
if ((trigger.notificationChannels as string[]).includes("email")) {
  await queueNotificationEmail({
    templateId: "daily_lead_update",
    userId: trigger.userId,
    data: { triggerName: trigger.name, triggerId: trigger.id, matchCount: unique.length, companies: summaries },
  });
}
```

`notificationChannels` already exists on `leadTrigger` as a jsonb array — user sets `["in_app", "email"]` via settings UI.

---

## SendGrid Webhook (`app/api/email/webhook/route.ts`)

- `export const runtime = "nodejs"`
- Verify ECDSA signature via `crypto.createVerify("SHA256")` using `process.env.SENDGRID_WEBHOOK_PUBLIC_KEY`
- Parse JSON body, switch on `event.event`, update `emailLog` row by `messageId`
- Events handled: `delivered`, `bounce`, `dropped`, `open`, `click`, `unsubscribe`, `spamreport`
- Always return `200` (same pattern as `app/api/stripe/webhook/route.ts`)
- Future: on `unsubscribe`/`spamreport`, set `userBrand.emailNotificationsEnabled = false`

Register webhook URL in SendGrid dashboard: `https://cvr-mate.vercel.app/api/email/webhook`

---

## Environment Variables

```bash
# SendGrid (primary)
SENDGRID_API_KEY=SG.xxx
SENDGRID_WEBHOOK_PUBLIC_KEY=MFkwEwY...   # from SendGrid Event Webhook settings

# Gmail/SMTP fallback (Option A: App Password — simpler for dev)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=xxxx xxxx xxxx xxxx

# Gmail/SMTP fallback (Option B: OAuth2 — more secure for prod)
GMAIL_OAUTH2_CLIENT_ID=xxx.apps.googleusercontent.com
GMAIL_OAUTH2_CLIENT_SECRET=GOCSPX-xxx
GMAIL_OAUTH2_REFRESH_TOKEN=1//xxx
GMAIL_USER=noreply@yourdomain.com

# Shared sender identity
EMAIL_FROM_ADDRESS=noreply@cvr-mate.com
EMAIL_FROM_NAME=CVR-MATE

# QStash — already present from existing cron setup
QSTASH_TOKEN=xxx
QSTASH_CURRENT_SIGNING_KEY=sig_xxx
QSTASH_NEXT_SIGNING_KEY=sig_xxx
```

---

## Implementation Order

**Phase 1 — Foundation**
1. Install packages
2. Add `emailLog` table + `userBrand` columns → generate + run migration
3. Implement `lib/email/types.ts`, `providers/sendgrid.ts`, `providers/gmail.ts`, `mailer.ts`

**Phase 2 — Auth emails** (unblocks signup UX)
4. Build templates: `verification.tsx`, `reset-password.tsx`, `welcome.tsx`
5. Build sender wrappers in `lib/email/senders/`
6. Wire all Better Auth callbacks in `lib/auth.ts`

**Phase 3 — Team invitations**
7. Build `team-invitation.tsx` template + sender
8. Wire `sendInvitationEmail` in `organization()` plugin config

**Phase 4 — Async notification emails**
9. Build `daily-lead-update.tsx`, `weekly-summary.tsx` templates + senders
10. Implement `lib/email/queue.ts`
11. Implement `app/api/email/notify/route.ts` (QStash receiver)
12. Integrate `queueNotificationEmail` into `app/api/cron/triggers/route.ts`
13. Add preferences API route: `app/api/preferences/email-notifications/route.ts`

**Phase 5 — Delivery tracking**
14. Implement `app/api/email/webhook/route.ts`
15. Register webhook URL in SendGrid dashboard

---

## Critical Files to Modify

| File | Change |
|------|--------|
| `db/app-schema.ts` | Add `emailLog` table + 4 `userBrand` columns |
| `lib/auth.ts` | Wire 4 Better Auth email callbacks |
| `app/api/cron/triggers/route.ts` | Call `queueNotificationEmail` when channel includes `"email"` |
| `lib/qstash.ts` | Reused as-is for QStash signature verification in `/api/email/notify` |
| `app/api/stripe/webhook/route.ts` | Used as structural template for SendGrid webhook route |

---

## Verification Checklist

1. **Signup** → email/password signup → verify email arrives, link works, `emailVerified` flips to `true`
2. **Password reset** → trigger forgot-password flow → reset email arrives, link works
3. **Welcome email** → first signup → welcome email arrives after `databaseHooks.user.create.after`
4. **Team invitation** → Settings → Team → Invite → email arrives with Accept button
5. **Notification email** → set trigger `notificationChannels = ["in_app", "email"]` → trigger fires via QStash cron → daily update email arrives
6. **Fallback** → set invalid `SENDGRID_API_KEY` → verify Gmail fallback sends successfully → `emailLog` shows `provider = "gmail"`
7. **Opt-out** → set `dailyLeadEmails = false` → trigger fires → email NOT sent (`/api/email/notify` returns `{ skipped: true }`)
8. **Bounce tracking** → simulate SendGrid bounce webhook → `emailLog.deliveryStatus` updated to `"bounced"`
9. **TypeScript** → `pnpm tsc --noEmit` passes with zero errors
