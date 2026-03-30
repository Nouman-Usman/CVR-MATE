import "server-only";

import { createHmac } from "crypto";
import { db } from "@/db";
import { webhook, webhookDelivery } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ─── Types ──────────────────────────────────────────────────────────────────

export type WebhookEvent =
  | "company.saved"
  | "company.unsaved"
  | "company.assigned"
  | "trigger.matched"
  | "trigger.created"
  | "crm.synced"
  | "member.invited"
  | "member.removed"
  | "member.role_changed"
  | "todo.created"
  | "todo.completed"
  | "note.created"
  | "export.completed";

interface WebhookPayload {
  event: WebhookEvent;
  organizationId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// ─── HMAC Signing ───────────────────────────────────────────────────────────

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

// ─── Deliver to a single webhook ────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // ms
const DELIVERY_TIMEOUT = 10_000; // 10s

async function deliverToWebhook(
  wh: typeof webhook.$inferSelect,
  payload: WebhookPayload
): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, wh.secret);

  let lastError: Error | null = null;
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let duration = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT);

      const response = await fetch(wh.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": payload.event,
          "X-Webhook-Timestamp": payload.timestamp,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      duration = Date.now() - start;
      responseStatus = response.status;
      responseBody = await response.text().catch(() => null);

      if (response.ok) {
        // Success — log delivery and reset failure count
        await db.insert(webhookDelivery).values({
          webhookId: wh.id,
          event: payload.event,
          payload,
          responseStatus,
          responseBody: responseBody?.slice(0, 1000) ?? null,
          duration,
          status: "success",
        });

        await db
          .update(webhook)
          .set({ failureCount: 0, lastDeliveredAt: new Date() })
          .where(eq(webhook.id, wh.id));

        return;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      duration = Date.now() - start;
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // All retries exhausted — log failure
  await db.insert(webhookDelivery).values({
    webhookId: wh.id,
    event: payload.event,
    payload,
    responseStatus,
    responseBody: responseBody?.slice(0, 1000) ?? lastError?.message ?? null,
    duration,
    status: "failed",
  });

  // Increment failure count; disable after 10 consecutive failures
  const currentFailures = (wh.failureCount ?? 0) + 1;
  await db
    .update(webhook)
    .set({
      failureCount: currentFailures,
      ...(currentFailures >= 10 ? { isActive: false } : {}),
    })
    .where(eq(webhook.id, wh.id));
}

// ─── Fan out to all matching webhooks ───────────────────────────────────────

/**
 * Dispatch a webhook event to all active webhooks for the org that subscribe to it.
 * Non-blocking — errors are logged but don't propagate.
 */
export async function dispatchWebhook(
  organizationId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const webhooks = await db.query.webhook.findMany({
      where: and(
        eq(webhook.organizationId, organizationId),
        eq(webhook.isActive, true)
      ),
    });

    const payload: WebhookPayload = {
      event,
      organizationId,
      timestamp: new Date().toISOString(),
      data,
    };

    // Filter to webhooks that subscribe to this event
    const matching = webhooks.filter((wh) => {
      const events = wh.events as string[];
      return events.length === 0 || events.includes(event);
    });

    // Fire all deliveries concurrently (non-blocking)
    await Promise.allSettled(
      matching.map((wh) => deliverToWebhook(wh, payload))
    );
  } catch (error) {
    console.error("[webhooks] Failed to dispatch:", error);
  }
}
