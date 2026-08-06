import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { quote, deal } from "@/db/schema";
import { isWellFormedToken } from "@/lib/quotes/public-token";
import { isRenderableSnapshot } from "@/lib/quotes/snapshot";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";
import { createNotification } from "@/lib/notifications";
import { logActivity } from "@/lib/activity/log";

export const runtime = "nodejs";

const respondSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

/**
 * POST /api/public/quotes/[token]/respond — the customer accepts or declines.
 *
 * UNAUTHENTICATED and state-changing, which makes it the most sensitive route in
 * the CRM. Protections, in order:
 *   - IP rate limit, failing CLOSED (no account to fall back on),
 *   - token shape filter before any query,
 *   - a conditional UPDATE guarded on `status = 'sent'`, so a double-click, a
 *     retried request, or two people sharing the link cannot accept twice,
 *   - validity re-checked server-side from the snapshot, never from the client.
 *
 * On accept the linked deal's amount is rolled up in the same transaction, the
 * same way the internal accept does — the customer's decision must not produce a
 * different result than the seller marking it accepted by hand.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`quote-ip:${ip}`, "public_quote_respond", 10, 60, {
    failClosed: true,
  });
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { token } = await params;
    if (!isWellFormedToken(token)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = respondSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    const { action } = parsed.data;

    const existing = await db.query.quote.findFirst({
      where: eq(quote.publicToken, token),
    });
    if (!existing || existing.deletedAt || !isRenderableSnapshot(existing.snapshot)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Validity is enforced here, not in the browser: an expired offer must not
    // become binding because someone kept a tab open.
    const today = new Date().toISOString().slice(0, 10);
    if (existing.snapshot.validUntil && existing.snapshot.validUntil < today) {
      return NextResponse.json(
        { error: "This quote has expired.", expired: true },
        { status: 409 }
      );
    }

    const now = new Date();
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(quote)
        .set(
          action === "accept"
            ? { status: "accepted", acceptedAt: now, respondedIp: ip }
            : { status: "rejected", rejectedAt: now, respondedIp: ip }
        )
        .where(
          and(
            eq(quote.id, existing.id),
            isNull(quote.deletedAt),
            eq(quote.status, "sent")
          )
        )
        .returning();

      if (!row) return null; // Already answered — reported as 409 below.

      if (action === "accept" && row.dealId) {
        await tx
          .update(deal)
          .set({ amount: row.total })
          .where(
            and(
              eq(deal.id, row.dealId),
              eq(deal.organizationId, row.organizationId),
              isNull(deal.deletedAt)
            )
          );
      }

      return row;
    });

    if (!updated) {
      return NextResponse.json(
        { error: "This quote has already been answered." },
        { status: 409 }
      );
    }

    // Tell the seller. Best-effort: the customer's decision is already recorded,
    // so a notification failure must not turn into an error for them.
    try {
      if (updated.createdBy) {
        await createNotification({
          userId: updated.createdBy,
          type: "system",
          title:
            action === "accept"
              ? `Tilbud ${updated.number} accepteret`
              : `Tilbud ${updated.number} afvist`,
          message: existing.snapshot.customer.name || undefined,
          link: `/quotes/${updated.id}`,
        });
      }
      await logActivity({
        userId: updated.createdBy ?? "",
        organizationId: updated.organizationId,
        entityType: "quote",
        entityId: updated.id,
        action: "updated",
        metadata: {
          companyId: updated.companyId,
          number: updated.number,
          status: updated.status,
          via: "public_link",
        },
      });
    } catch (err) {
      console.error("[public-quote] post-response notify failed:", err);
    }

    return NextResponse.json({ status: updated.status });
  } catch (err) {
    console.error("[public-quote] respond failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
