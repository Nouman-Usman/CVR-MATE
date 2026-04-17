/**
 * DEV-ONLY: End-to-end trigger test endpoint.
 *
 * Runs the full trigger flow for a specific user:
 *   1. Find/create a test trigger with notificationChannels: ["in_app", "email"]
 *   2. Execute a real CVR company search using the trigger's filters
 *   3. Store trigger results in trigger_result table
 *   4. Create an in-app notification (same as the cron does)
 *   5. Send the daily lead update email DIRECTLY (bypasses QStash since
 *      localhost can't receive QStash callbacks)
 *   6. Return a detailed result for each step
 *
 * Usage (in another terminal while `pnpm dev` is running):
 *   curl -s -X POST http://localhost:3000/api/dev/test-trigger \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"email": "you@example.com"}' | jq
 *
 * NEVER deployed to production — guarded by NODE_ENV check.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { user, leadTrigger, triggerResult } from "@/db/schema";
import { searchCompanies } from "@/lib/cvr-api";
import { createNotification } from "@/lib/notifications";
import { dispatchNotificationEmail } from "@/lib/email/dispatch";

// Hard block: this route must never be reachable in production
if (process.env.NODE_ENV === "production") {
  throw new Error("DEV test endpoint loaded in production — this should never happen");
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  // ── Guard ────────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  // Simple auth: CRON_SECRET Bearer token (same as manual cron testing)
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return unauthorized();
  }

  // ── Parse request ────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const targetEmail: string | undefined = body.email;

  // ── Find user ────────────────────────────────────────────────────────────
  const userQuery = targetEmail
    ? db.select().from(user).where(eq(user.email, targetEmail)).limit(1)
    : db.select().from(user).limit(1);

  const [targetUser] = await userQuery;
  if (!targetUser) {
    return NextResponse.json(
      { error: `No user found${targetEmail ? ` with email ${targetEmail}` : ""}` },
      { status: 404 }
    );
  }

  const steps: Record<string, unknown> = {
    user: { id: targetUser.id, email: targetUser.email, name: targetUser.name },
  };

  // ── Find or create a test trigger with email channel ────────────────────
  let trigger = await db.query.leadTrigger.findFirst({
    where: and(
      eq(leadTrigger.userId, targetUser.id),
      eq(leadTrigger.isActive, true)
    ),
  });

  if (!trigger) {
    // Create a minimal test trigger (no filters = broad search)
    const [created] = await db
      .insert(leadTrigger)
      .values({
        userId: targetUser.id,
        name: "Dev Test Trigger",
        filters: { industry_code: "62" }, // Software consultancies
        frequency: "daily",
        scheduledHour: 8,
        scheduledMinute: 0,
        timezone: "Europe/Copenhagen",
        isActive: true,
        notificationChannels: ["in_app", "email"],
      })
      .returning();
    trigger = created;
    steps.trigger = { created: true, id: trigger.id };
  } else {
    // Ensure the existing trigger has email in its channels
    const channels = (trigger.notificationChannels ?? []) as string[];
    if (!channels.includes("email")) {
      await db
        .update(leadTrigger)
        .set({ notificationChannels: [...channels, "email"] })
        .where(eq(leadTrigger.id, trigger.id));
    }
    steps.trigger = { created: false, id: trigger.id, name: trigger.name };
  }

  // ── CVR company search ───────────────────────────────────────────────────
  let companies: { vat: string; name: string; city: string; industry: string }[] = [];
  try {
    const filters = (trigger.filters ?? {}) as Record<string, unknown>;
    const searchParams: Record<string, string> = { companystatus_code: "20" };
    if (filters.industry_code) searchParams.industry_primary_code = String(filters.industry_code);
    if (filters.city) searchParams.address_city = String(filters.city);

    const raw = await searchCompanies(searchParams);
    const results = Array.isArray(raw) ? raw : [];

    // Deduplicate
    const seen = new Set<number>();
    const unique = results.filter((c) => {
      if (seen.has(c.vat)) return false;
      seen.add(c.vat);
      return true;
    });

    companies = unique.slice(0, 20).map((c) => ({
      vat: String(c.vat),
      name: c.life?.name ?? "",
      city: c.address?.cityname ?? "",
      industry: c.industry?.primary?.text ?? "",
    }));

    steps.cvrSearch = { matchCount: unique.length, showing: companies.length };
  } catch (err) {
    steps.cvrSearch = { error: String(err) };
    // Continue — we can still test notifications with mock data
    companies = [
      { vat: "12345678", name: "Mock ApS", city: "Copenhagen", industry: "Software" },
      { vat: "87654321", name: "Demo A/S", city: "Aarhus", industry: "Consulting" },
    ];
  }

  const matchCount = companies.length;

  // ── Store trigger result ─────────────────────────────────────────────────
  try {
    await db.insert(triggerResult).values({
      triggerId: trigger.id,
      userId: targetUser.id,
      companies,
      matchCount,
    });
    steps.triggerResult = { stored: true, matchCount };
  } catch (err) {
    steps.triggerResult = { error: String(err) };
  }

  // ── In-app notification ──────────────────────────────────────────────────
  try {
    await createNotification({
      userId: targetUser.id,
      type: "trigger",
      title: `${trigger.name}: ${matchCount} matches`,
      message:
        companies
          .slice(0, 3)
          .map((c) => c.name)
          .filter(Boolean)
          .join(", ") + (matchCount > 3 ? ` +${matchCount - 3} more` : ""),
      link: "/triggers",
    });
    steps.inAppNotification = { sent: true };
  } catch (err) {
    steps.inAppNotification = { error: String(err) };
  }

  // ── Email dispatch (same path as the real trigger run) ──────────────────
  // dispatchNotificationEmail detects localhost → sends directly (no QStash hop)
  try {
    await dispatchNotificationEmail({
      templateId: "daily_lead_update",
      userId: targetUser.id,
      data: {
        triggerName: trigger.name,
        triggerId: trigger.id,
        matchCount,
        companies,
      },
    });
    steps.email = { dispatched: true, to: targetUser.email };
  } catch (err) {
    steps.email = { dispatched: false, error: String(err) };
  }

  return NextResponse.json({ ok: true, steps });
}
