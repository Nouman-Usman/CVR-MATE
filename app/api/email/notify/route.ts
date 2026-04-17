// QStash receiver for async notification emails (production path).
// In development, trigger routes call lib/email/dispatch.ts directly.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyQStashRequest } from "@/lib/qstash";
import { sendNotificationEmail } from "@/lib/email/dispatch";
import type { EmailQueuePayload } from "@/lib/email/types";

export async function POST(req: NextRequest) {
  // ── Verify QStash signature ────────────────────────────────────────────
  if (!(await verifyQStashRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse payload ──────────────────────────────────────────────────────
  let payload: EmailQueuePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Send ───────────────────────────────────────────────────────────────
  try {
    const result = await sendNotificationEmail(payload);

    if ("skipped" in result) {
      return NextResponse.json({ skipped: true, reason: result.reason });
    }

    return NextResponse.json({ sent: true, provider: result.provider, to: result.to });
  } catch (err) {
    console.error(`[email/notify] Send failed for ${payload.templateId}:`, err);
    // 500 tells QStash to retry (up to retries: 3)
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}
