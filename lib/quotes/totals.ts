/**
 * Quotation / order money engine. Everything is INTEGER ØRE (1 DKK = 100 øre).
 *
 * The one rule that keeps quotes correct: round each line, then sum (the Danish
 * convention) — never sum floats and round once. This module is pure (no I/O, no
 * server-only) so it can run identically on the server (authoritative recompute)
 * and be unit-tested in isolation.
 */

export interface LineInput {
  quantity: number; // may be fractional (e.g. 2.5 hours)
  unitPrice: number; // øre, integer
  discountPct: number; // 0..100
  vatRate: number; // 0..100 (Danish moms defaults to 25)
}

export interface LineTotals {
  lineSubtotal: number; // øre — net, after discount, before VAT
  lineDiscount: number; // øre
  lineVat: number; // øre
  lineTotal: number; // øre — incl VAT
}

export interface DocTotals {
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  total: number;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

/** Compute one line's øre totals. Gross → discount → net → VAT → total. */
export function computeLine(input: LineInput): LineTotals {
  const qty = Number.isFinite(input.quantity) ? input.quantity : 0;
  const unit = Math.round(input.unitPrice) || 0;
  const discountPct = clamp(input.discountPct, 0, 100);
  const vatRate = Math.max(0, Number.isFinite(input.vatRate) ? input.vatRate : 0);

  const gross = Math.round(qty * unit);
  const lineDiscount = Math.round(gross * (discountPct / 100));
  const lineSubtotal = gross - lineDiscount;
  const lineVat = Math.round(lineSubtotal * (vatRate / 100));
  const lineTotal = lineSubtotal + lineVat;

  return { lineSubtotal, lineDiscount, lineVat, lineTotal };
}

/** Compute every line + the document totals (sum of the per-line rounded values). */
export function computeDoc(lines: LineInput[]): { lines: LineTotals[]; totals: DocTotals } {
  const computed = lines.map(computeLine);
  const totals = computed.reduce<DocTotals>(
    (acc, l) => ({
      subtotal: acc.subtotal + l.lineSubtotal,
      discountTotal: acc.discountTotal + l.lineDiscount,
      vatTotal: acc.vatTotal + l.lineVat,
      total: acc.total + l.lineTotal,
    }),
    { subtotal: 0, discountTotal: 0, vatTotal: 0, total: 0 }
  );
  return { lines: computed, totals };
}
