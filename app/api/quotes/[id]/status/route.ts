import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { quote, deal } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse, CrmConflictError } from "@/lib/crm/guard";
import { parseBody, quoteStatusSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { assertCanMutateResource } from "@/lib/team/permissions";
import { companyVatById } from "@/lib/crm/company-resolver";

async function loadOwnedQuote(id: string, organizationId: string) {
  const row = await db.query.quote.findFirst({ where: eq(quote.id, id) });
  if (!row || row.organizationId !== organizationId || row.deletedAt) return null;
  return row;
}

/** The legal transitions, and the timestamp each one stamps. */
const TRANSITIONS = {
  send: {
    from: "draft",
    to: "sent",
    stamp: "sentAt",
    error: "Only a draft quote can be sent.",
  },
  accept: {
    from: "sent",
    to: "accepted",
    stamp: "acceptedAt",
    error: "Only a sent quote can be accepted.",
  },
  reject: {
    from: "sent",
    to: "rejected",
    stamp: "rejectedAt",
    error: "Only a sent quote can be rejected.",
  },
} as const;

/**
 * POST /api/quotes/[id]/status  { action: "send" | "accept" | "reject" }
 *
 * Transitions are conditional writes (`WHERE status = $from`), so concurrent
 * accept+reject cannot both land — the loser gets a 409 rather than producing a
 * quote that is rejected but carries an acceptedAt and has already rolled up.
 *
 * On accept the quote total (øre) rolls up to its linked deal's amount (whole
 * DKK). The rollup shares the transaction: an accepted quote whose deal was
 * never updated is a silent reporting error with no retry path.
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

    // Advancing a quote fires the deal rollup and is what the customer sees —
    // it is at least as consequential as editing the draft, which is gated.
    await assertCanMutateResource(userId, {
      userId: existing.createdBy ?? "",
      organizationId: existing.organizationId,
    });

    const parsed = parseBody(quoteStatusSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { action } = parsed.data;

    const transition = TRANSITIONS[action];
    const now = new Date();

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(quote)
        .set({ status: transition.to, [transition.stamp]: now })
        .where(
          and(
            eq(quote.id, existing.id),
            eq(quote.organizationId, organizationId),
            isNull(quote.deletedAt),
            eq(quote.status, transition.from)
          )
        )
        .returning();

      if (!row) throw new CrmConflictError(transition.error);

      // Deal rollup: accepted quote total (øre) → deal.amount (whole DKK).
      // Math.round, not raw division: deal.amount is whole kroner by convention
      // and the numeric column would silently accept fractions. The deletedAt
      // guard stops an accept from writing into an already-deleted deal.
      if (action === "accept" && row.dealId) {
        await tx
          .update(deal)
          .set({ amount: String(Math.round(row.total / 100)) })
          .where(
            and(
              eq(deal.id, row.dealId),
              eq(deal.organizationId, organizationId),
              isNull(deal.deletedAt)
            )
          );
      }

      return row;
    });

    await logActivity({
      userId,
      organizationId,
      entityType: "quote",
      entityId: updated.id,
      action: "updated",
      metadata: { companyId: updated.companyId, number: updated.number, status: updated.status },
    });

    // dealId lets the client invalidate the deal + board caches, which otherwise
    // keep showing the pre-rollup amount; companyVat keys the activity timeline.
    return NextResponse.json({
      quote: updated,
      dealId: updated.dealId,
      companyVat: await companyVatById(updated.companyId),
    });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
