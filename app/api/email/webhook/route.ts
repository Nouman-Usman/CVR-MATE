// SendGrid Event Webhook — receives delivery, bounce, open, click, and
// unsubscribe events and writes them back to the emailLog table.
//
// Setup:
//   1. Add SENDGRID_WEBHOOK_PUBLIC_KEY (PEM) from SendGrid → Settings →
//      Mail Settings → Event Webhook → Signature Verification.
//   2. Register this URL in the same page:
//      https://cvr-mate.vercel.app/api/email/webhook
//   3. Enable: Delivered, Bounced, Dropped, Opened, Clicked, Unsubscribed,
//      Spam Reports.
export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { emailLog, userBrand } from "@/db/schema";
import type { SendGridWebhookEvent } from "@/lib/email/types";

// ─── Signature verification ────────────────────────────────────────────────

/**
 * Verify the ECDSA P-256 signature that SendGrid attaches to every batch.
 * Signed payload = timestamp header value + raw body (no separator).
 * Signature encoding is ieee-p1363 (r||s), NOT ASN.1 DER.
 */
function verifySendGridSignature(
  publicKeyPem: string,
  signature: string,  // X-Twilio-Email-Event-Webhook-Signature (base64)
  timestamp: string,  // X-Twilio-Email-Event-Webhook-Timestamp
  body: string
): boolean {
  try {
    const verifier = crypto.createVerify("SHA256");
    verifier.update(timestamp + body);
    return verifier.verify(
      { key: publicKeyPem, dsaEncoding: "ieee-p1363" },
      signature,
      "base64"
    );
  } catch {
    return false;
  }
}

// ─── Message ID lookup ─────────────────────────────────────────────────────

/**
 * SendGrid's sg_message_id = "<X-Message-Id>.filter-chain.timestamp.suffix"
 * We stored only the X-Message-Id portion; extract it for the DB lookup.
 */
function baseMessageId(sgMessageId: string | undefined): string | null {
  if (!sgMessageId) return null;
  return sgMessageId.split(".")[0] ?? null;
}

// ─── Event handlers ────────────────────────────────────────────────────────

async function handleDelivered(event: SendGridWebhookEvent) {
  const id = baseMessageId(event.sg_message_id);
  if (!id) return;
  await db
    .update(emailLog)
    .set({ deliveryStatus: "delivered" })
    .where(eq(emailLog.messageId, id));
}

async function handleBounced(event: SendGridWebhookEvent) {
  const id = baseMessageId(event.sg_message_id);
  if (!id) return;
  await db
    .update(emailLog)
    .set({
      deliveryStatus: "bounced",
      bouncedAt: new Date(),
      status: "failed",
      error: [event.reason, event.status].filter(Boolean).join(" — ") || null,
    })
    .where(eq(emailLog.messageId, id));
}

async function handleDropped(event: SendGridWebhookEvent) {
  const id = baseMessageId(event.sg_message_id);
  if (!id) return;
  await db
    .update(emailLog)
    .set({
      deliveryStatus: "dropped",
      status: "failed",
      error: event.reason ?? null,
    })
    .where(eq(emailLog.messageId, id));
}

async function handleOpened(event: SendGridWebhookEvent) {
  const id = baseMessageId(event.sg_message_id);
  if (!id) return;
  // Only stamp openedAt once (first open wins)
  await db
    .update(emailLog)
    .set({ deliveryStatus: "opened", openedAt: new Date() })
    .where(eq(emailLog.messageId, id) && isNull(emailLog.openedAt));
}

async function handleClicked(event: SendGridWebhookEvent) {
  const id = baseMessageId(event.sg_message_id);
  if (!id) return;
  // Only stamp clickedAt once (first click wins)
  await db
    .update(emailLog)
    .set({ deliveryStatus: "clicked", clickedAt: new Date() })
    .where(eq(emailLog.messageId, id) && isNull(emailLog.clickedAt));
}

async function handleUnsubscribeOrSpam(
  event: SendGridWebhookEvent,
  deliveryStatus: "unsubscribed" | "spam"
) {
  const id = baseMessageId(event.sg_message_id);
  if (!id) return;

  // Update the email log row
  const [row] = await db
    .update(emailLog)
    .set({ deliveryStatus })
    .where(eq(emailLog.messageId, id))
    .returning({ userId: emailLog.userId });

  // Disable all email notifications for this user
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
        `[email/webhook] Disabled email notifications for user ${userId} (${deliveryStatus})`
      );
    }
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.text();

  // ── Signature verification ─────────────────────────────────────────────
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;

  if (publicKey) {
    const signature = req.headers.get("X-Twilio-Email-Event-Webhook-Signature");
    const timestamp = req.headers.get("X-Twilio-Email-Event-Webhook-Timestamp");

    if (!signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing SendGrid signature headers" },
        { status: 400 }
      );
    }

    if (!verifySendGridSignature(publicKey, signature, timestamp, body)) {
      console.error("[email/webhook] Signature verification failed");
      return NextResponse.json(
        { error: "Signature verification failed" },
        { status: 400 }
      );
    }
  } else {
    // In local dev without a key configured, log a warning but proceed.
    // Never skip verification in production — set SENDGRID_WEBHOOK_PUBLIC_KEY.
    console.warn("[email/webhook] SENDGRID_WEBHOOK_PUBLIC_KEY not set — skipping verification");
  }

  // ── Parse batch ────────────────────────────────────────────────────────
  let events: SendGridWebhookEvent[];
  try {
    events = JSON.parse(body);
    if (!Array.isArray(events)) throw new Error("Expected array");
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Dispatch events ────────────────────────────────────────────────────
  await Promise.allSettled(
    events.map(async (event) => {
      try {
        switch (event.event) {
          case "delivered":
            await handleDelivered(event);
            break;
          case "bounce":
            await handleBounced(event);
            break;
          case "dropped":
            await handleDropped(event);
            break;
          case "open":
            await handleOpened(event);
            break;
          case "click":
            await handleClicked(event);
            break;
          case "unsubscribe":
            await handleUnsubscribeOrSpam(event, "unsubscribed");
            break;
          case "spamreport":
            await handleUnsubscribeOrSpam(event, "spam");
            break;
          case "deferred":
            // Transient delay — SendGrid retries automatically, nothing to do
            break;
          default:
            break;
        }
      } catch (err) {
        // Log per-event failures but don't fail the whole batch
        console.error(`[email/webhook] Error processing event ${event.event}:`, err);
      }
    })
  );

  // Always return 200 — SendGrid will retry on non-2xx responses.
  // Per-event failures are logged above; the batch is acknowledged regardless.
  return NextResponse.json({ received: true, count: events.length });
}
