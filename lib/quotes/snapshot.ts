/**
 * The frozen record of a quote as it was sent to the customer.
 *
 * Why a snapshot rather than rendering live rows: a sent quote is a commercial
 * offer, and its meaning is fixed at the moment of sending. If the public page
 * read live data, editing a product's price — or the seller's own address —
 * would retroactively rewrite what the customer was shown, including after they
 * accepted. Every representation (public page, PDF, email summary) derives from
 * this one object.
 *
 * Pure data, no I/O, so it can be built server-side and rendered on either side.
 */

export interface SnapshotSeller {
  name: string;
  cvr: string | null;
  address: string | null;
  zipCity: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  /** Hex brand colour used for document accents. */
  color: string | null;
}

export interface SnapshotCustomer {
  name: string;
  cvr: string | null;
  address: string | null;
  zipCity: string | null;
  contactName: string | null;
  contactEmail: string | null;
}

export interface SnapshotLine {
  description: string;
  /** Decimal string as stored (numeric column). */
  quantity: string;
  unitPrice: number; // øre
  discountPct: string;
  vatRate: string;
  lineSubtotal: number; // øre
  lineDiscount: number; // øre
  lineVat: number; // øre
  lineTotal: number; // øre
}

export interface QuoteSnapshot {
  /** Bumped when the shape changes, so old snapshots stay renderable. */
  version: 1;
  number: string;
  currency: string;
  issueDate: string | null;
  validUntil: string | null;
  terms: string | null;
  notes: string | null;
  seller: SnapshotSeller;
  customer: SnapshotCustomer;
  lines: SnapshotLine[];
  subtotal: number; // øre
  discountTotal: number; // øre
  vatTotal: number; // øre
  total: number; // øre
  /** ISO timestamp the snapshot was frozen (i.e. when the quote was sent). */
  capturedAt: string;
}

/** A snapshot missing its seller block is a document with no issuer. */
export function isRenderableSnapshot(value: unknown): value is QuoteSnapshot {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<QuoteSnapshot>;
  return (
    s.version === 1 &&
    typeof s.number === "string" &&
    Array.isArray(s.lines) &&
    !!s.seller &&
    typeof s.seller.name === "string" &&
    typeof s.total === "number"
  );
}

/**
 * Fields a Danish commercial quote is expected to carry from the issuer. Used to
 * warn the seller before sending rather than after the customer has seen it.
 */
export function missingSellerFields(seller: SnapshotSeller): string[] {
  const missing: string[] = [];
  if (!seller.name?.trim()) missing.push("name");
  if (!seller.cvr?.trim()) missing.push("cvr");
  if (!seller.address?.trim()) missing.push("address");
  return missing;
}
