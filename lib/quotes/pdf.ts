"use client";

import { formatOre } from "@/lib/format";

export interface QuotePdfLine {
  description: string;
  quantity: string | number;
  unitPrice: number; // øre
  discountPct: string | number;
  vatRate: string | number;
  lineSubtotal: number; // øre
}

export interface QuotePdfData {
  number: string;
  companyName: string;
  companyVat: string;
  issueDate: string | null;
  validUntil: string | null;
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  total: number;
  terms: string | null;
  lines: QuotePdfLine[];
}

/**
 * Generate + download a quote PDF entirely in the browser (jsPDF + autotable),
 * mirroring the exports-page pattern. Money is formatted from øre via formatOre.
 */
export async function generateQuotePdf(data: QuotePdfData, locale: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const money = (ore: number) => formatOre(ore, locale);
  const da = locale === "da";

  doc.setFontSize(20);
  doc.text(da ? "Tilbud" : "Quote", 14, 20);
  doc.setFontSize(11);
  doc.text(data.number, 14, 27);

  doc.setFontSize(9);
  doc.text(`${data.companyName} · CVR ${data.companyVat}`, 14, 36);
  let y = 41;
  if (data.issueDate) {
    doc.text(`${da ? "Dato" : "Date"}: ${data.issueDate}`, 14, y);
    y += 5;
  }
  if (data.validUntil) {
    doc.text(`${da ? "Gyldig til" : "Valid until"}: ${data.validUntil}`, 14, y);
    y += 5;
  }

  autoTable(doc, {
    startY: y + 3,
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
    body: data.lines.map((l) => [
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
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  const rightX = doc.internal.pageSize.getWidth() - 14;
  let ty = finalY + 8;
  doc.setFontSize(9);
  const row = (label: string, value: string) => {
    doc.text(`${label}: ${value}`, rightX, ty, { align: "right" });
    ty += 5;
  };
  row(da ? "Subtotal" : "Subtotal", money(data.subtotal));
  if (data.discountTotal > 0) row(da ? "Rabat" : "Discount", money(data.discountTotal));
  row(da ? "Moms" : "VAT", money(data.vatTotal));
  doc.setFontSize(12);
  doc.text(`${da ? "Total" : "Total"}: ${money(data.total)}`, rightX, ty + 2, { align: "right" });

  if (data.terms) {
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(data.terms, 180), 14, ty + 14);
  }

  doc.save(`${data.number}.pdf`);
}
