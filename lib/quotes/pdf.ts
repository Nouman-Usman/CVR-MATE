"use client";

import { formatOre } from "@/lib/format";
import type { QuoteSnapshot } from "./snapshot";

/**
 * Render a quote PDF in the browser (jsPDF + autotable) from a snapshot.
 *
 * Taking the snapshot rather than live rows is the point: a sent quote's PDF
 * must keep showing what the customer was sent, even after the price list or
 * the seller's own details change. Drafts have no snapshot yet, so the caller
 * builds a provisional one — same shape, same renderer, no second code path.
 */

const MARGIN = 14;
const BOTTOM_LIMIT_MM = 275; // A4 is 297mm tall; leave a footer margin.

export async function generateQuotePdf(snap: QuoteSnapshot, locale: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const money = (ore: number) => formatOre(ore, locale);
  const da = locale === "da";
  const rightX = doc.internal.pageSize.getWidth() - MARGIN;

  /** Move down, starting a new page when the content would run off it. */
  function advance(y: number, delta: number): number {
    if (y + delta > BOTTOM_LIMIT_MM) {
      doc.addPage();
      return 20;
    }
    return y + delta;
  }

  doc.setFontSize(20);
  doc.text(da ? "Tilbud" : "Quote", MARGIN, 20);
  doc.setFontSize(11);
  doc.text(snap.number, MARGIN, 27);

  // ── Seller (issuer) — right column ────────────────────────────────────────
  // A commercial quote that does not name its issuer is not a valid offer; the
  // previous version printed only the customer.
  doc.setFontSize(9);
  let sy = 20;
  const sellerLines = [
    snap.seller.name,
    snap.seller.cvr ? `CVR ${snap.seller.cvr}` : null,
    snap.seller.address,
    snap.seller.zipCity,
    snap.seller.email,
    snap.seller.phone,
    snap.seller.website,
  ].filter(Boolean) as string[];
  for (const line of sellerLines) {
    doc.text(line, rightX, sy, { align: "right" });
    sy += 4.5;
  }

  // ── Customer — left column ────────────────────────────────────────────────
  let y = 38;
  doc.setFontSize(8);
  doc.text(da ? "Til" : "To", MARGIN, y);
  y += 4.5;
  doc.setFontSize(9);
  const customerLines = [
    snap.customer.name,
    snap.customer.cvr ? `CVR ${snap.customer.cvr}` : null,
    snap.customer.address,
    snap.customer.zipCity,
    snap.customer.contactName,
  ].filter(Boolean) as string[];
  for (const line of customerLines) {
    doc.text(line, MARGIN, y);
    y += 4.5;
  }

  y += 3;
  if (snap.issueDate) {
    doc.text(`${da ? "Dato" : "Date"}: ${snap.issueDate}`, MARGIN, y);
    y += 5;
  }
  if (snap.validUntil) {
    doc.text(`${da ? "Gyldig til" : "Valid until"}: ${snap.validUntil}`, MARGIN, y);
    y += 5;
  }

  autoTable(doc, {
    startY: Math.max(y + 3, sy + 3),
    head: [
      [
        da ? "Beskrivelse" : "Description",
        da ? "Antal" : "Qty",
        da ? "Enhedspris" : "Unit price",
        da ? "Rabat" : "Disc.",
        da ? "Moms" : "VAT",
        da ? "Beløb" : "Amount",
      ],
    ],
    body: snap.lines.map((l) => [
      l.description,
      String(l.quantity),
      money(l.unitPrice),
      `${l.discountPct}%`,
      `${l.vatRate}%`,
      money(l.lineSubtotal),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      5: { halign: "right" },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;

  // Totals and terms used to be drawn with no page-height check, so on a long
  // quote they were emitted below the bottom of the last page — invisible.
  let ty = advance(finalY, 8);
  doc.setFontSize(9);
  const row = (label: string, value: string) => {
    doc.text(`${label}: ${value}`, rightX, ty, { align: "right" });
    ty = advance(ty, 5);
  };
  row(da ? "Subtotal" : "Subtotal", money(snap.subtotal));
  if (snap.discountTotal > 0) row(da ? "Rabat" : "Discount", money(snap.discountTotal));
  row(da ? "Moms" : "VAT", money(snap.vatTotal));
  ty = advance(ty, 2);
  doc.setFontSize(12);
  doc.text(`${da ? "Total" : "Total"}: ${money(snap.total)}`, rightX, ty, { align: "right" });

  if (snap.terms) {
    ty = advance(ty, 12);
    doc.setFontSize(8);
    const wrapped: string[] = doc.splitTextToSize(snap.terms, 180);
    for (const line of wrapped) {
      doc.text(line, MARGIN, ty);
      ty = advance(ty, 4);
    }
  }

  doc.save(`${snap.number}.pdf`);
}
