import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quote, deal } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { parseBody, quoteStatusSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";

async function loadOwnedQuote(id: string, organizationId: string) {
  const row = await db.query.quote.findFirst({ where: eq(quote.id, id) });
  if (!row || row.organizationId !== organizationId || row.deletedAt) return null;
  return row;
}

/**
 * POST /api/quotes/[id]/status  { action: "send" | "accept" | "reject" }
 * Guarded status transitions: draft→sent, sent→accepted, sent→rejected. On
 * accept, the quote total (øre) rolls up to its linked deal's amount (whole DKK).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_quote_status", 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    const existing = await loadOwnedQuote(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    const parsed = parseBody(quoteStatusSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { action } = parsed.data;

    const now = new Date();
    const patch: Partial<typeof quote.$inferInsert> = {};

    if (action === "send") {
      if (existing.status !== "draft") {
        return NextResponse.json({ error: "Only a draft quote can be sent." }, { status: 409 });
      }
      patch.status = "sent";
      patch.sentAt = now;
    } else if (action === "accept") {
      if (existing.status !== "sent") {
        return NextResponse.json({ error: "Only a sent quote can be accepted." }, { status: 409 });
      }
      patch.status = "accepted";
      patch.acceptedAt = now;
    } else {
      // reject
      if (existing.status !== "sent") {
        return NextResponse.json({ error: "Only a sent quote can be rejected." }, { status: 409 });
      }
      patch.status = "rejected";
      patch.rejectedAt = now;
    }

    const [updated] = await db
      .update(quote)
      .set(patch)
      .where(eq(quote.id, existing.id))
      .returning();

    // Deal value rollup: accepted quote total (øre) → deal.amount (whole DKK).
    if (action === "accept" && existing.dealId) {
      await db
        .update(deal)
        .set({ amount: String(updated.total / 100) })
        .where(eq(deal.id, existing.dealId));
    }

    await logActivity({
      userId,
      organizationId,
      entityType: "quote",
      entityId: updated.id,
      action: "updated",
      metadata: { companyId: updated.companyId, number: updated.number, status: updated.status },
    });

    return NextResponse.json({ quote: updated });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
