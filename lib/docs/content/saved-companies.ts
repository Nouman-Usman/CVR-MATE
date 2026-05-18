import type { DocPage } from "../types";

export const savedCompaniesDoc: DocPage = {
  slug: "saved-companies",
  title: { en: "Saved Companies", da: "Gemte virksomheder" },
  description: {
    en: "Organise your prospect list with tags, notes, and bulk actions. Your personal CRM layer inside CVR-MATE.",
    da: "Organisér din prospektliste med tags, noter og massehandlinger. Dit personlige CRM-lag inde i CVR-MATE.",
  },
  sections: [
    {
      id: "saving-companies",
      title: { en: "Saving a company", da: "Gem en virksomhed" },
      body: {
        en: "Hover any company row in Search results or on a Company detail page and click the heart (♥) icon. The company is immediately added to your Saved Companies list.",
        da: "Hover over en virksomhedsrække i søgeresultater eller på en virksomhedsdetaljeside og klik på hjerte-ikonet (♥). Virksomheden tilføjes øjeblikkeligt til din liste over gemte virksomheder.",
      },
    },
    {
      id: "tagging",
      title: { en: "Tags", da: "Tags" },
      body: {
        en: "Add one or more tags to any saved company to categorise your pipeline. Use tags like 'Hot lead', 'Follow up', or any custom label. Filter the list by tag to focus on a specific segment.",
        da: "Tilføj et eller flere tags til enhver gemt virksomhed for at kategorisere din pipeline. Brug tags som 'Hot lead', 'Opfølgning' eller en anden tilpasset etiket. Filtrer listen efter tag for at fokusere på et bestemt segment.",
      },
      screenshot: {
        slug: "saved-companies/table",
        alt: { en: "Saved companies table with tags", da: "Gemte virksomheder tabel med tags" },
      },
    },
    {
      id: "notes",
      title: { en: "Inline notes", da: "Inline noter" },
      body: {
        en: "Each row in the saved companies table has an expandable notes field. Click the note icon to add or edit a note without leaving the list view.",
        da: "Hver række i tabellen over gemte virksomheder har et udvideligt noteringsfelt. Klik på note-ikonet for at tilføje eller redigere en note uden at forlade listevisningen.",
      },
    },
    {
      id: "bulk-actions",
      title: { en: "Bulk actions", da: "Massehandlinger" },
      body: {
        en: "Select multiple companies using the checkboxes, then use the bulk action bar to export selected companies to CSV or push them to your CRM in a single operation.",
        da: "Vælg flere virksomheder ved hjælp af afkrydsningsfelterne, og brug derefter massehandlingsbjælken til at eksportere valgte virksomheder til CSV eller pushe dem til din CRM i én operation.",
      },
      badge: "Pro",
      screenshot: {
        slug: "saved-companies/bulk",
        alt: { en: "Bulk action bar", da: "Massehandlingsbjælke" },
      },
    },
    {
      id: "context-menu",
      title: { en: "Context menu", da: "Kontekstmenu" },
      body: {
        en: "Right-click or click the ⋯ menu on any row to access per-company actions: edit tags, add note, create linked task, push to CRM, or remove from saved list.",
        da: "Højreklik eller klik på ⋯-menuen på en række for at få adgang til handlinger pr. virksomhed: rediger tags, tilføj note, opret tilknyttet opgave, push til CRM eller fjern fra gemt liste.",
      },
    },
    {
      id: "pipeline-analysis",
      title: { en: "AI pipeline analysis", da: "AI pipeline-analyse" },
      body: {
        en: "CVR-MATE can analyse your entire saved companies list and produce a pipeline summary — identifying the strongest prospects, common patterns, and recommended next steps based on your brand tone and product.",
        da: "CVR-MATE kan analysere din fulde liste over gemte virksomheder og producere en pipeline-sammenfatning — identificere de stærkeste prospekter, fælles mønstre og anbefalede næste skridt baseret på din brandtone og dit produkt.",
      },
      badge: "Pro",
    },
  ],
};
