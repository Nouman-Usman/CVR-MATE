import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { orderInvoice } from "@/db/app-schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { invoiceOrder } from "@/lib/accounting/invoice";
import { syncInvoices } from "@/lib/accounting/sync";
import { AccountingError, accountingErrorToStatus } from "@/lib/accounting/types";

export const runtime = "nodejs";

/**
 * POST /api/orders/[id]/invoice — hand the order to the bookkeeping system.
 *
 * Creates a DRAFT and stops. Booking allocates a legal invoice number and is
 * undone only by a credit note, so the last step stays with a human in the
 * provider's own UI. The response says so explicitly rather than reporting
 * "invoiced", which would overstate what happened.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "order_invoice", 60, 3600);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    const result = await invoiceOrder(organizationId, id, userId);

    return NextResponse.json(
      {
        invoiceId: result.invoiceId,
        externalId: result.externalId,
        status: result.status,
        // Surfaced, never swallowed: the provider may compute VAT from the
        // customer's VAT zone rather than our per-line rate.
        totalsMismatch: result.reconciliation.mismatch,
        mismatchReason: result.reconciliation.reason,
        nextStep: "Book and send the draft in your accounting system.",
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AccountingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: accountingErrorToStatus(err) }
      );
    }
    return crmErrorResponse(err);
  }
}

/** GET — the mirrored invoice for this order, if one exists. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const { id } = await params;
    const [row] = await db
      .select()
      .from(orderInvoice)
      .where(and(eq(orderInvoice.orderId, id), eq(orderInvoice.organizationId, organizationId)))
      .limit(1);

    return NextResponse.json({ invoice: row ?? null });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/**
 * PATCH — re-read this organization's invoices from the provider.
 *
 * A pull, not a push: the only thing a user can do to a mirrored invoice is ask
 * for the provider's current answer. There is no endpoint to edit the status,
 * the number or the amounts, because that would create a second source of truth
 * for a legal document.
 */
export async function PATCH(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "accounting_sync", 20, 3600);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const result = await syncInvoices(organizationId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AccountingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: accountingErrorToStatus(err) }
      );
    }
    return crmErrorResponse(err);
  }
}
