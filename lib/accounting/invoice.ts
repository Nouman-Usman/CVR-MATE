import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  orderInvoice,
  organizationProfile,
  salesOrder,
  salesOrderLine,
} from "@/db/app-schema";
import { logActivity } from "@/lib/activity/log";

import {
  recordConnectionError,
  recordConnectionSuccess,
  requireConnection,
} from "./connection";
import { resolveCustomer } from "./customer-resolver";
import { orderToDraftInvoice, reconcileTotals, type Reconciliation } from "./mapping";
import { AccountingError } from "./types";

export interface InvoiceOrderResult {
  invoiceId: string;
  externalId: string;
  status: string;
  reconciliation: Reconciliation;
}

/**
 * Turn a fulfilled order into a DRAFT invoice in the org's bookkeeping system.
 *
 * Draft, never booked: booking allocates a legal invoice number and can only be
 * undone with a credit note, so a person does it in the provider's own UI. This
 * function's job ends at "there is a draft, and here is how it compares to the
 * order".
 *
 * Not wrapped in a database transaction, deliberately. The provider call is the
 * irreversible part and it happens outside our control; a transaction around it
 * would roll back our record of a draft that genuinely exists in e-conomic,
 * which is worse than the alternative. Instead the mirror row is written
 * immediately after creation, and `order_invoice_live_uq` prevents a second
 * live invoice for the same order.
 */
export async function invoiceOrder(
  organizationId: string,
  orderId: string,
  userId: string
): Promise<InvoiceOrderResult> {
  const [order] = await db
    .select()
    .from(salesOrder)
    .where(
      and(
        eq(salesOrder.id, orderId),
        eq(salesOrder.organizationId, organizationId),
        isNull(salesOrder.deletedAt)
      )
    )
    .limit(1);
  if (!order) throw new AccountingError("NOT_FOUND", "Order not found.");

  if (order.status === "cancelled") {
    throw new AccountingError("INVALID_REQUEST", "A cancelled order cannot be invoiced.");
  }

  // Cheap pre-check for the common case. The unique index is still the
  // authority — see the catch below.
  const [already] = await db
    .select({ id: orderInvoice.id, status: orderInvoice.status })
    .from(orderInvoice)
    .where(and(eq(orderInvoice.orderId, orderId), eq(orderInvoice.organizationId, organizationId)))
    .limit(1);
  if (already && already.status !== "cancelled") {
    throw new AccountingError("INVALID_REQUEST", "This order has already been invoiced.");
  }

  const lines = await db
    .select()
    .from(salesOrderLine)
    .where(eq(salesOrderLine.orderId, orderId))
    .orderBy(asc(salesOrderLine.sortOrder));

  const [profile] = await db
    .select({ terms: organizationProfile.defaultPaymentTermsDays })
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, organizationId))
    .limit(1);

  const { connection, client } = await requireConnection(organizationId);

  try {
    const customer = await resolveCustomer(
      client,
      connection.id,
      order.companyId,
      organizationId
    );

    const draftInput = orderToDraftInvoice(
      {
        number: order.number,
        currency: order.currency,
        orderDate: order.orderDate,
        notes: order.notes,
        total: order.total,
        vatTotal: order.vatTotal,
      },
      lines,
      {
        customerExternalId: customer.externalId,
        paymentTermsDays: profile?.terms ?? 14,
      }
    );

    const created = await client.createDraftInvoice(draftInput);

    // What the provider actually built, compared with what we sent. e-conomic
    // derives VAT from the customer's VAT zone rather than our per-line rate, so
    // this is a real check, not a formality.
    const reconciliation = reconcileTotals(
      { total: order.total, vatTotal: order.vatTotal, currency: order.currency },
      created
    );

    const [row] = await db
      .insert(orderInvoice)
      .values({
        organizationId,
        orderId,
        connectionId: connection.id,
        provider: connection.provider,
        externalId: created.externalId,
        invoiceNumber: created.invoiceNumber,
        status: created.status,
        issueDate: created.issueDate,
        dueDate: created.dueDate,
        currency: created.currency,
        total: created.totalOre,
        vatTotal: created.vatTotalOre,
        totalsMismatch: reconciliation.mismatch,
        pdfUrl: created.pdfUrl,
        lastSyncedAt: new Date(),
        createdBy: userId,
      })
      .returning({ id: orderInvoice.id });

    await recordConnectionSuccess(connection.id);

    await logActivity({
      userId,
      organizationId,
      entityType: "order",
      entityId: orderId,
      action: "invoiced",
      metadata: {
        provider: connection.provider,
        externalId: created.externalId,
        orderNumber: order.number,
        customerMatchedBy: customer.matchedBy,
        totalsMismatch: reconciliation.mismatch,
        ...(reconciliation.mismatch ? { mismatchReason: reconciliation.reason } : {}),
      },
    });

    return {
      invoiceId: row.id,
      externalId: created.externalId,
      status: created.status,
      reconciliation,
    };
  } catch (err) {
    if (err instanceof AccountingError) {
      await recordConnectionError(connection.id, err.detail ?? err.message);
    }
    throw err;
  }
}
