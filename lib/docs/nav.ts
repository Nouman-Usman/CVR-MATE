import type { DocNavGroup } from "./types";

export const DOC_NAV: DocNavGroup[] = [
  {
    label: { en: "Getting started", da: "Kom i gang" },
    items: [
      { slug: "overview",  title: { en: "Overview",  da: "Oversigt" } },
      { slug: "dashboard", title: { en: "Dashboard", da: "Dashboard" } },
    ],
  },
  {
    label: { en: "Finding leads", da: "Find leads" },
    items: [
      { slug: "search",         title: { en: "Search",         da: "Søg virksomheder" } },
      { slug: "triggers",       title: { en: "Triggers",       da: "Lead Triggers" } },
      { slug: "saved-searches", title: { en: "Saved Searches", da: "Gemte søgninger" } },
    ],
  },
  {
    label: { en: "Managing leads", da: "Håndter leads" },
    items: [
      { slug: "company",         title: { en: "Company Detail",   da: "Virksomhedsdetalje" } },
      { slug: "saved-companies", title: { en: "Saved Companies",  da: "Gemte virksomheder" } },
      { slug: "todos",           title: { en: "Todos",            da: "Opgaver" } },
    ],
  },
  {
    label: { en: "Exporting & CRM", da: "Eksport & CRM" },
    items: [
      { slug: "exports",      title: { en: "Exports",      da: "Eksport" } },
      { slug: "integrations", title: { en: "Integrations", da: "Integrationer" } },
    ],
  },
  {
    label: { en: "Account", da: "Konto" },
    items: [
      { slug: "settings", title: { en: "Settings", da: "Indstillinger" } },
    ],
  },
];

export const ALL_DOC_SLUGS = DOC_NAV.flatMap((g) => g.items.map((i) => i.slug));
