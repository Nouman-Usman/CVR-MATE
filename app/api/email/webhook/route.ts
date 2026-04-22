// Resend Event Webhook — receives delivery, bounce, open, click, and
// complaint events and writes them back to the emailLog table.
//
// Setup in Resend dashboard → Webhooks:
//   1. Add endpoint: https://cvr-mate.vercel.app/api/email/webhook
//   2. Select events: email.delivered, email.bounced, email.complained,
//      email.opened, email.clicked, email.delivery_delayed
//   3. Copy the signing secret → RESEND_WEBHOOK_SECRET env var
//
// Resend signs webhooks using Svix (HMAC-SHA256). Verification algorithm:
//   signed_content = "{svix-id}.{svix-timestamp}.{raw_body}"
//   key = base64_decode(secret_after_stripping_"whsec_"_prefix)
//   expected = base64_encode(hmac_sha256(key, signed_content))
//   compare against each sig in "svix-signature" (space-separated "v1,<sig>" list)
//   timestamp must be within ±5 minutes to prevent replay attacks
export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { emailLog, userBrand } from "@/db/schema";
import type { ResendWebhookEvent } from "@/lib/email/types";

// ─── Signature verification ────────────────────────────────────────────────

function verifySignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  body: string
): boolean {
  try {
    // Reject stale/replayed webhooks (±5 minute window)
    const tsMs = Number(svixTimestamp) * 1000;
    if (isNaN(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
      return false;
    }

    const rawSecret = secret.startsWith("whsec_")
      ? secret.slice("whsec_".length)
      : secret;
    const key = Buffer.from(rawSecret, "base64");
    const signedContent = `${svixId}.${svixTimestamp}.${body}`;
    const expected = crypto
      .createHmac("sha256", key)
      .update(signedContent)
      .digest("base64");

    // svix-signature is a space-separated list of "v1,<base64>" entries
    return svixSignature.split(" ").some((entry) => {
      const sig = entry.startsWith("v1,") ? entry.slice(3) : entry;
      try {
        return crypto.timingSafeEqual(
          Buffer.from(expected),
          Buffer.from(sig, "base64")
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

// ─── Event handlers ────────────────────────────────────────────────────────

async function handleDelivered(event: ResendWebhookEvent) {
  await db
    .update(emailLog)
    .set({ deliveryStatus: "delivered" })
    .where(eq(emailLog.messageId, event.data.email_id));
}

async function handleBounced(event: ResendWebhookEvent) {
  const reason = event.data.bounce?.message ?? null;
  await db
    .update(emailLog)
    .set({
      deliveryStatus: "bounced",
      bouncedAt: new Date(),
      status: "failed",
      error: reason,
    })
    .where(eq(emailLog.messageId, event.data.email_id));
}

async function handleDelayed(event: ResendWebhookEvent) {
  // Transient delay — Resend retries automatically; just update delivery status
  await db
    .update(emailLog)
    .set({ deliveryStatus: "deferred" })
    .where(eq(emailLog.messageId, event.data.email_id));
}

async function handleOpened(event: ResendWebhookEvent) {
  // Only stamp openedAt once (first open wins)
  await db
    .update(emailLog)
    .set({ deliveryStatus: "opened", openedAt: new Date() })
    .where(
      and(
        eq(emailLog.messageId, event.data.email_id),
        isNull(emailLog.openedAt)
      )
    );
}

async function handleClicked(event: ResendWebhookEvent) {
  // Only stamp clickedAt once (first click wins)
  await db
    .update(emailLog)
    .set({ deliveryStatus: "clicked", clickedAt: new Date() })
    .where(
      and(
        eq(emailLog.messageId, event.data.email_id),
        isNull(emailLog.clickedAt)
      )
    );
}

async function handleComplained(event: ResendWebhookEvent) {
  const [row] = await db
    .update(emailLog)
    .set({ deliveryStatus: "spam" })
    .where(eq(emailLog.messageId, event.data.email_id))
    .returning({ userId: emailLog.userId });

  const userId = row?.userId;
  if (userId) {
    const existing = await db.query.userBrand.findFirst({
      where: eq(userBrand.userId, userId),
      columns: { id: true },
    });
    if (existing) {
      await db
        .update(userBrand)
        .set({ emailNotificationsEnabled: false })
        .where(eq(userBrand.id, existing.id));
      console.log(
        `[email/webhook] Disabled email notifications for user ${userId} (spam complaint)`
      );
    }
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.text();

  // ── Signature verification — always required ───────────────────────────
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[email/webhook] RESEND_WEBHOOK_SECRET not configured — rejecting request");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing Resend webhook signature headers" },
      { status: 400 }
    );
  }

  if (!verifySignature(secret, svixId, svixTimestamp, svixSignature, body)) {
    console.error("[email/webhook] Signature verification failed");
    return NextResponse.json(
      { error: "Signature verification failed" },
      { status: 401 }
    );
  }

  // ── Parse event ────────────────────────────────────────────────────────
  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(body);
    if (!event?.type || !event?.data?.email_id) throw new Error("Invalid shape");
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Dispatch event ─────────────────────────────────────────────────────
  try {
    switch (event.type) {
      case "email.delivered":
        await handleDelivered(event);
        break;
      case "email.bounced":
        await handleBounced(event);
        break;
      case "email.delivery_delayed":
        await handleDelayed(event);
        break;
      case "email.opened":
        await handleOpened(event);
        break;
      case "email.clicked":
        await handleClicked(event);
        break;
      case "email.complained":
        await handleComplained(event);
        break;
      case "email.sent":
        // Already logged by mailer.ts at send time; nothing to update
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`[email/webhook] Error processing event ${event.type}:`, err);
    // Return 500 so Resend retries the delivery
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ received: true, type: event.type });
}
