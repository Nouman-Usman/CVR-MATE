/**
 * Order → draft invoice, and the reconciliation that follows.
 *
 * Pure: no I/O, no `server-only`. This is where the load-bearing decisions live,
 * so they can be unit-tested without a provider account — which matters more
 * here than usual, because the adapter itself cannot be exercised until an
 * e-conomic agreement exists.
 */

import type { AccountingInvoice, AccountingInvoiceLine, DraftInvoiceInput } from "./types";

/** The order fields the mapping needs. Kept structural so callers can pass rows. */
export interface OrderForInvoice {
  number: string;
  currency: string;
  orderDate: string | null;
  notes: string | null;
  /** Order totals in øre, as CVR-MATE computed them. */
  total: number;
  vatTotal: number;
}

export interface OrderLineForInvoice {
  description: string;
  quantity: string | number;
  unitPrice: number;
  discountPct: string | number;
  vatRate: string | number;
  externalProductId?: string | null;
}

/** `numeric` columns arrive as strings from the driver; totals must not inherit NaN. */
function num(value: string | number, fallback: number): number {
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/** `YYYY-MM-DD` in UTC — dates on an invoice are calendar dates, not instants. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Due date from an issue date and net payment terms.
 *
 * Deliberately plain calendar-day arithmetic: "netto 14" in Danish invoicing
 * means 14 calendar days, not 14 business days, and inventing bank-holiday logic
 * here would silently disagree with what the accounting system prints.
 */
export function dueDateFrom(issueDate: string, paymentTermsDays: number): string {
  const base = new Date(`${issueDate}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) {
    throw new Error(`dueDateFrom: invalid issueDate ${issueDate}`);
  }
  const days = Number.isFinite(paymentTermsDays) ? Math.max(0, Math.trunc(paymentTermsDays)) : 0;
  base.setUTCDate(base.getUTCDate() + days);
  return toIsoDate(base);
}

export interface MapOptions {
  customerExternalId: string;
  paymentTermsDays: number;
  /** Defaults to the order date, then to today. */
  issueDate?: string;
}

/**
 * Build the draft-invoice payload for an order.
 *
 * `reference` carries the CVR-MATE order number so the two systems can be
 * reconciled by eye — without it, an invoice in e-conomic has no visible link
 * back to what was sold.
 */
export function orderToDraftInvoice(
  order: OrderForInvoice,
  orderLines: OrderLineForInvoice[],
  opts: MapOptions
): DraftInvoiceInput {
  if (orderLines.length === 0) {
    // An empty invoice would be booked as a zero-value legal document.
    throw new Error("orderToDraftInvoice: an order with no lines cannot be invoiced");
  }

  const issueDate = opts.issueDate ?? order.orderDate ?? toIsoDate(new Date());

  const lines: AccountingInvoiceLine[] = orderLines.map((l) => ({
    description: l.description,
    quantity: num(l.quantity, 0),
    unitPriceOre: l.unitPrice,
    discountPct: num(l.discountPct, 0),
    vatRate: num(l.vatRate, 0),
    externalProductId: l.externalProductId ?? null,
  }));

  return {
    customerExternalId: opts.customerExternalId,
    currency: order.currency,
    issueDate,
    dueDate: dueDateFrom(issueDate, opts.paymentTermsDays),
    reference: order.number,
    notes: order.notes,
    lines,
  };
}

export interface Reconciliation {
  mismatch: boolean;
  /** provider − order, in øre. Positive means the provider charged more. */
  totalDeltaOre: number;
  vatDeltaOre: number;
  reason: string | null;
}

/**
 * Compare what we sent with what the provider actually created.
 *
 * This is not paranoia. e-conomic derives VAT from the customer's VAT zone and
 * the product's configuration rather than from the per-line rate we send, so a
 * domestic 25% line and an EU reverse-charge customer will legitimately produce
 * different totals at the two ends. Neither side can simply be trusted:
 *
 *   • trusting ours means the order says one thing and the invoice the client
 *     receives says another
 *   • trusting theirs silently means a VAT-zone misconfiguration invoices the
 *     wrong amount and nobody notices until the quarter closes
 *
 * So the difference is recorded and surfaced, and a human decides. Exact
 * equality is the bar — these are integers in øre, and "close enough" is not a
 * standard that applies to an invoice.
 */
export function reconcileTotals(
  order: Pick<OrderForInvoice, "total" | "vatTotal" | "currency">,
  invoice: Pick<AccountingInvoice, "totalOre" | "vatTotalOre" | "currency">
): Reconciliation {
  const totalDeltaOre = invoice.totalOre - order.total;
  const vatDeltaOre = invoice.vatTotalOre - order.vatTotal;

  if (order.currency !== invoice.currency) {
    return {
      mismatch: true,
      totalDeltaOre,
      vatDeltaOre,
      // Comparing amounts across currencies is meaningless, so this is reported
      // as the currency problem it is rather than as a totals difference.
      reason: `Currency differs: order is ${order.currency}, invoice is ${invoice.currency}`,
    };
  }

  if (totalDeltaOre === 0 && vatDeltaOre === 0) {
    return { mismatch: false, totalDeltaOre: 0, vatDeltaOre: 0, reason: null };
  }

  const parts: string[] = [];
  if (totalDeltaOre !== 0) parts.push(`total differs by ${formatOreDelta(totalDeltaOre)}`);
  if (vatDeltaOre !== 0) parts.push(`VAT differs by ${formatOreDelta(vatDeltaOre)}`);

  return {
    mismatch: true,
    totalDeltaOre,
    vatDeltaOre,
    reason: `${parts.join("; ")} — check the customer's VAT zone and the product VAT setup`,
  };
}

/** `+12,50 DKK` / `−3,00 DKK`. Danish decimal comma, explicit sign. */
function formatOreDelta(ore: number): string {
  const sign = ore < 0 ? "−" : "+";
  const abs = Math.abs(ore);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")} DKK`;
}
