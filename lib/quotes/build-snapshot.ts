import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  quote,
  quoteLine,
  company,
  contact,
  userBrand,
  organizationProfile,
} from "@/db/schema";
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

  const [lines, comp, org, orgProfile, brand] = await Promise.all([
    db.query.quoteLine.findMany({
      where: eq(quoteLine.quoteId, q.id),
      orderBy: [asc(quoteLine.sortOrder)],
    }),
    db.query.company.findFirst({ where: eq(company.id, q.companyId) }),
    db.query.organization.findFirst({ where: eq(organization.id, organizationId) }),
    // The seller of record. Org-scoped, so every member of an org issues
    // documents under the same identity.
    db.query.organizationProfile.findFirst({
      where: eq(organizationProfile.organizationId, organizationId),
    }),
    // Legacy fallback only, for orgs created before profiles existed. Identity
    // used to come from here alone — keyed by userId, so two members of one org
    // stamped different seller blocks on quotes to the same customer, and no
    // address existed anywhere to stamp. Remove once every org is backfilled.
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

  /**
   * The org profile wins as a WHOLE RECORD, not field by field.
   *
   * Falling back per field looks harmless and quietly reinstates the bug this
   * replaced: where the profile happens to leave a field blank, the value would
   * come from whichever member pressed send, so two colleagues still issued
   * documents that differed — just in fewer places, which is harder to notice.
   * A profile that exists is the issuer; a blank field in it means blank.
   *
   * `userBrand` is consulted only when an org has no profile at all, i.e. one
   * created before profiles existed and not yet backfilled. Remove the branch
   * once `organization_profile` is guaranteed non-empty for every org.
   */
  const seller: SnapshotSeller = orgProfile
    ? {
        name: orgProfile.legalName?.trim() || org?.name?.trim() || "",
        cvr: orgProfile.cvr?.trim() || null,
        address: orgProfile.addressLine?.trim() || null,
        // Composed, never stored: a display string derived from two columns is
        // how the two drift apart.
        zipCity:
          [orgProfile.zipCode?.trim(), orgProfile.city?.trim()].filter(Boolean).join(" ") ||
          null,
        email: orgProfile.email?.trim() || null,
        phone: orgProfile.phone?.trim() || null,
        website: orgProfile.website?.trim() || null,
        color: orgProfile.brandColor?.trim() || null,
      }
    : {
        name: brand?.companyName?.trim() || org?.name?.trim() || "",
        cvr: brand?.cvr?.trim() || null,
        // No address has ever existed on userBrand; missingSellerFields()
        // surfaces the gap to the sender before the customer sees it.
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
