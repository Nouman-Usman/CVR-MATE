import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { quote, quoteLine, company, contact, userBrand } from "@/db/schema";
import { organization } from "@/db/auth-schema";
import { decryptField } from "@/lib/pii/crypto";
import type {
  QuoteSnapshot,
  SnapshotCustomer,
  SnapshotLine,
  SnapshotSeller,
} from "./snapshot";

/**
 * Freeze a quote into the document the customer will see.
 *
 * Called once, when the quote is sent. Everything the public page and the PDF
 * need is copied in — including the seller's own details, because a quote that
 * does not say who issued it is not a commercial document, and because the
 * seller's branding can change after sending.
 */
export async function buildQuoteSnapshot(
  quoteId: string,
  organizationId: string,
  userId: string
): Promise<QuoteSnapshot> {
  const q = await db.query.quote.findFirst({ where: eq(quote.id, quoteId) });
  if (!q || q.organizationId !== organizationId) {
    throw new Error("Quote not found for snapshot");
  }

  const [lines, comp, org, brand] = await Promise.all([
    db.query.quoteLine.findMany({
      where: eq(quoteLine.quoteId, q.id),
      orderBy: [asc(quoteLine.sortOrder)],
    }),
    db.query.company.findFirst({ where: eq(company.id, q.companyId) }),
    db.query.organization.findFirst({ where: eq(organization.id, organizationId) }),
    // KNOWN LIMITATION: seller identity is resolved from the *issuing user's*
    // brand profile, because `userBrand` is keyed by userId and there is no
    // organization-level branding table. Two members of the same org can
    // therefore stamp different seller blocks on quotes from the same company.
    // Freezing it into the snapshot at least makes each document internally
    // consistent forever; the real fix is org-level branding.
    db.query.userBrand.findFirst({ where: eq(userBrand.userId, userId) }),
  ]);

  // Prefer the company's primary contact as the named recipient.
  const primary = await db.query.contact.findFirst({
    where: and(
      eq(contact.companyId, q.companyId),
      eq(contact.organizationId, organizationId),
      eq(contact.isPrimary, true),
      isNull(contact.deletedAt)
    ),
  });

  const seller: SnapshotSeller = {
    // Brand profile first, then the org name — never blank, or the document has
    // no issuer at all.
    name: brand?.companyName?.trim() || org?.name?.trim() || "",
    cvr: brand?.cvr?.trim() || null,
    // No address field exists on userBrand yet; missingSellerFields() surfaces
    // this to the seller before they send.
    address: null,
    zipCity: null,
    email: null,
    phone: null,
    website: brand?.website?.trim() || null,
    color: null,
  };

  const customer: SnapshotCustomer = {
    name: comp?.name ?? "",
    cvr: comp?.vat ?? null,
    address: comp?.address ?? null,
    zipCity: [comp?.zipcode, comp?.city].filter(Boolean).join(" ") || null,
    // `name` is plaintext; only email/phone/notes are encrypted at rest.
    contactName: primary?.name ?? null,
    contactEmail: primary?.emailEnc ? decryptField(primary.emailEnc) : null,
  };

  const snapshotLines: SnapshotLine[] = lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discountPct: l.discountPct,
    vatRate: l.vatRate,
    lineSubtotal: l.lineSubtotal,
    lineDiscount: l.lineDiscount,
    lineVat: l.lineVat,
    lineTotal: l.lineTotal,
  }));

  return {
    version: 1,
    number: q.number,
    currency: q.currency,
    issueDate: q.issueDate,
    validUntil: q.validUntil,
    terms: q.terms,
    notes: q.notes,
    seller,
    customer,
    lines: snapshotLines,
    subtotal: q.subtotal,
    discountTotal: q.discountTotal,
    vatTotal: q.vatTotal,
    total: q.total,
    capturedAt: new Date().toISOString(),
  };
}
