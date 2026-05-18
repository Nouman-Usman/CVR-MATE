import type { DocPage } from "../types";

export const exportsDoc: DocPage = {
  slug: "exports",
  title: { en: "Exports", da: "Eksport" },
  description: {
    en: "Download your lead data as CSV or XLSX, or push it directly to your CRM.",
    da: "Download dine leaddata som CSV eller XLSX, eller push dem direkte til din CRM.",
  },
  sections: [
    {
      id: "export-formats",
      title: { en: "Export formats", da: "Eksportformater" },
      body: {
        en: "CVR-MATE supports two export formats. Choose the one that fits your workflow.",
        da: "CVR-MATE understøtter to eksportformater. Vælg det, der passer til din arbejdsgang.",
      },
      features: {
        en: [
          "CSV (.csv) — universal, compatible with all CRMs, databases, and spreadsheet apps",
          "XLSX (.xlsx) — formatted Excel workbook with column headers and proper data types",
        ],
        da: [
          "CSV (.csv) — universelt, kompatibelt med alle CRM'er, databaser og regnearksprogrammer",
          "XLSX (.xlsx) — formateret Excel-projektmappe med kolonneoverskrifter og korrekte datatyper",
        ],
      },
      badge: "Pro",
    },
    {
      id: "column-selection",
      title: { en: "Column selection", da: "Kolonnevalg" },
      body: {
        en: "Before downloading, choose which data columns to include. Deselect columns you don't need to keep your export clean and import-ready.",
        da: "Før download skal du vælge, hvilke datakolonner der skal inkluderes. Fravælg kolonner, du ikke har brug for, for at holde din eksport ren og importklar.",
      },
      features: {
        en: [
          "Company name, CVR number, legal form",
          "Address, city, postal code",
          "Industry code and description",
          "Employee count",
          "Revenue, gross profit, net result (latest year)",
          "Founded date, status",
          "Email, phone (when available)",
          "Your tags and notes",
        ],
        da: [
          "Firmanavn, CVR-nummer, juridisk form",
          "Adresse, by, postnummer",
          "Branchekode og -beskrivelse",
          "Medarbejderantal",
          "Omsætning, bruttoprofit, nettoresultat (seneste år)",
          "Stiftelsesdato, status",
          "E-mail, telefon (når tilgængeligt)",
          "Dine tags og noter",
        ],
      },
      screenshot: {
        slug: "exports/column-select",
        alt: { en: "Column selection interface", da: "Kolonnevalgsgrænseflade" },
      },
    },
    {
      id: "export-sources",
      title: { en: "Export sources", da: "Eksportkilder" },
      body: {
        en: "You can initiate an export from multiple places in CVR-MATE.",
        da: "Du kan starte en eksport fra flere steder i CVR-MATE.",
      },
      features: {
        en: [
          "Search page — exports current filtered results",
          "Saved Companies — exports selected companies (or full list)",
          "Exports page — manage and re-download previous exports",
        ],
        da: [
          "Søgeside — eksporterer aktuelle filtrerede resultater",
          "Gemte virksomheder — eksporterer valgte virksomheder (eller fuld liste)",
          "Eksportside — administrer og re-download tidligere eksporter",
        ],
      },
    },
    {
      id: "export-history",
      title: { en: "Export history", da: "Eksporthistorik" },
      body: {
        en: "The Exports page keeps a log of all your previous exports. Re-download any past export without re-running the search.",
        da: "Eksportsiden fører en log over alle dine tidligere eksporter. Re-download enhver tidligere eksport uden at køre søgningen igen.",
      },
      screenshot: {
        slug: "exports/download",
        alt: { en: "Export history and download", da: "Eksporthistorik og download" },
      },
    },
  ],
};
