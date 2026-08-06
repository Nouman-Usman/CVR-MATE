import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { quote } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse, CrmConflictError } from "@/lib/crm/guard";
import { assertCanMutateResource } from "@/lib/team/permissions";
import { parseBody } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { companyVatById } from "@/lib/crm/company-resolver";
import { buildQuoteSnapshot } from "@/lib/quotes/build-snapshot";
import { generatePublicToken } from "@/lib/quotes/public-token";
import { sendQuoteEmail } from "@/lib/email/senders/quote-sent";
import { auth } from "@/lib/auth";

const sendSchema = z.object({
  to: z.string().trim().email("A valid recipient email is required"),
  message: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().max(2000).optional()
  ),
});

/** Absolute base URL for links that leave the app. */
function publicBaseUrl(req: NextRequest): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  if (configured) return configured.replace(/\/$/, "");
  return req.nextUrl.origin;
}

/**
 * POST /api/quotes/[id]/send — deliver a draft quote to the customer.
 *
 * This is the transition that turns an internal draft into a commercial offer,
 * so it does three things a plain status change never did:
 *   1. freezes a snapshot of the document (seller + customer + lines + totals),
 *   2. mints a 256-bit capability token for the public accept page,
 *   3. emails the customer a link to it.
 *
 * Ordering is deliberate. The database work commits first, then the email goes
 * out — an email referencing a token that was rolled back would 404 for the
 * customer. The reverse failure (committed, email fails) is recoverable: the
 * caller gets a clear error and the link still works if shared manually.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_quote_send", 30, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    const parsed = parseBody(sendSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { to, message } = parsed.data;

    const existing = await db.query.quote.findFirst({ where: eq(quote.id, id) });
    if (!existing || existing.organizationId !== organizationId || existing.deletedAt) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    await assertCanMutateResource(userId, {
      userId: existing.createdBy ?? "",
      organizationId: existing.organizationId,
    });

    // Built before the transaction: it reads several tables and must not hold
    // the quote row locked while it does.
    const snapshot = await buildQuoteSnapshot(id, organizationId, userId);
    const token = generatePublicToken();

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(quote)
        .set({
          status: "sent",
          sentAt: new Date(),
          snapshot,
          publicToken: token,
        })
        .where(
          and(
            eq(quote.id, existing.id),
            eq(quote.organizationId, organizationId),
            isNull(quote.deletedAt),
            eq(quote.status, "draft")
          )
        )
        .returning();

      if (!row) throw new CrmConflictError("Only a draft quote can be sent.");
      return row;
    });

    const quoteUrl = `${publicBaseUrl(req)}/q/${token}`;

    let emailed = true;
    let emailError: string | null = null;
    try {
      const session = await auth.api.getSession({ headers: req.headers });
      await sendQuoteEmail({
        to,
        sellerName: snapshot.seller.name,
        customerName: snapshot.customer.name,
        quoteNumber: snapshot.number,
        totalOre: snapshot.total,
        validUntil: snapshot.validUntil,
        quoteUrl,
        message: message ?? null,
        senderId: userId,
        senderEmail: session?.user?.email ?? null,
      });
    } catch (err) {
      // The quote is legitimately sent — the link exists and works. Report the
      // delivery failure without pretending the state change did not happen.
      emailed = false;
      emailError = err instanceof Error ? err.message : "Email delivery failed";
      console.error("[crm] Quote email failed:", err);
    }

    await logActivity({
      userId,
      organizationId,
      entityType: "quote",
      entityId: updated.id,
      action: "updated",
      metadata: {
        companyId: updated.companyId,
        number: updated.number,
        status: "sent",
        recipient: to,
        emailed,
      },
    });

    return NextResponse.json({
      quote: updated,
      quoteUrl,
      emailed,
      emailError,
      companyVat: await companyVatById(updated.companyId),
    });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
