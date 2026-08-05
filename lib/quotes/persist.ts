import "server-only";

import { computeDoc, type LineInput } from "./totals";

/** A validated line as it arrives from the API (money in øre). */
export interface NormalizedLineInput {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number; // øre
  discountPct?: number;
  vatRate?: number;
}

/** A line row ready to insert (minus quoteId/orderId + organizationId). */
export interface BuiltLineRow {
  productId: string | null;
  description: string;
  quantity: string; // numeric column → string
  unitPrice: number; // øre
  discountPct: string;
  vatRate: string;
  lineSubtotal: number;
  lineDiscount: number;
  lineVat: number;
  lineTotal: number;
  sortOrder: number;
}

/**
 * Run the øre totals engine over the submitted lines and shape both the line
 * rows (with server-computed per-line totals) and the document totals. This is
 * the single place the server derives money — routes never persist client totals.
 */
export function buildDocument(lines: NormalizedLineInput[]) {
  const inputs: LineInput[] = lines.map((l) => ({
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discountPct: l.discountPct ?? 0,
    vatRate: l.vatRate ?? 25,
  }));
  const { lines: computed, totals } = computeDoc(inputs);

  const lineRows: BuiltLineRow[] = lines.map((l, i) => ({
    productId: l.productId ?? null,
    description: l.description,
    quantity: String(l.quantity),
    unitPrice: l.unitPrice,
    discountPct: String(l.discountPct ?? 0),
    vatRate: String(l.vatRate ?? 25),
    lineSubtotal: computed[i].lineSubtotal,
    lineDiscount: computed[i].lineDiscount,
    lineVat: computed[i].lineVat,
    lineTotal: computed[i].lineTotal,
    sortOrder: i,
  }));

  return { lineRows, totals };
}
