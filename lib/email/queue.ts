import "server-only";
import { Client } from "@upstash/qstash";
import type { EmailQueuePayload } from "./types";

/**
 * Enqueue a notification email for async delivery via QStash.
 * The QStash worker at /api/email/notify will:
 *   1. Verify the signature
 *   2. Check the user's opt-out preferences
 *   3. Render and send the appropriate template
 */
export async function queueNotificationEmail(payload: EmailQueuePayload): Promise<void> {
  if (!process.env.QSTASH_TOKEN) {
    console.warn("[email] QSTASH_TOKEN not set — skipping email queue");
    return;
  }

  const baseUrl = process.env.BETTER_AUTH_URL ?? "https://cvr-mate.vercel.app";
  const client = new Client({ token: process.env.QSTASH_TOKEN });

  await client.publishJSON({
    url: `${baseUrl}/api/email/notify`,
    body: payload,
    retries: 3,
  });
}
