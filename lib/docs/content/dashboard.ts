import type { DocPage } from "../types";

export const dashboardDoc: DocPage = {
  slug: "dashboard",
  title: { en: "Dashboard", da: "Dashboard" },
  description: {
    en: "Your command centre — activity metrics, quick stats, and recent trigger results at a glance.",
    da: "Dit kommandocenter — aktivitetsmålinger, hurtige statistikker og seneste triggerresultater på ét blik.",
  },
  heroScreenshot: {
    slug: "dashboard/overview",
    alt: { en: "CVR-MATE dashboard overview", da: "CVR-MATE dashboard oversigt" },
  },
  sections: [
    {
      id: "stat-cards",
      title: { en: "Stat cards", da: "Statistikkort" },
      body: {
        en: "The four stat cards at the top of the dashboard give you an instant snapshot of your workspace activity.",
        da: "De fire statistikkort øverst på dashboardet giver dig et øjebliksbillede af din workspace-aktivitet.",
      },
      features: {
        en: [
          "Saved Searches — total number of saved filter sets",
          "Active Triggers — triggers currently running on a schedule",
          "Saved Companies — companies in your saved list",
          "Active Tasks — open todos not yet marked complete",
        ],
        da: [
          "Gemte søgninger — samlet antal gemte filtersæt",
          "Aktive triggers — triggers der kører på en tidsplan",
          "Gemte virksomheder — virksomheder i din gemte liste",
          "Aktive opgaver — åbne opgaver, der endnu ikke er markeret som fuldført",
        ],
      },
      screenshot: {
        slug: "dashboard/stat-cards",
        alt: { en: "Dashboard stat cards", da: "Dashboard statistikkort" },
      },
    },
    {
      id: "activity-chart",
      title: { en: "Weekly activity chart", da: "Ugentlig aktivitetsgraf" },
      body: {
        en: "The chart visualises your platform activity over the past seven days — searches run, companies saved, and trigger matches received. Use it to spot quiet periods and adjust your trigger schedules accordingly.",
        da: "Grafen visualiserer din platformsaktivitet over de seneste syv dage — søgninger kørt, virksomheder gemt og trigger-matches modtaget. Brug den til at opdage rolige perioder og justere dine triggertidsplaner derefter.",
      },
      screenshot: {
        slug: "dashboard/chart",
        alt: { en: "Weekly activity chart", da: "Ugentlig aktivitetsgraf" },
      },
    },
    {
      id: "recent-results",
      title: { en: "Recent trigger results", da: "Seneste triggerresultater" },
      body: {
        en: "Below the chart, the most recent companies matched by any of your triggers are listed. Click any company name to open its full detail page.",
        da: "Under grafen vises de seneste virksomheder matchet af dine triggers. Klik på et firmanavn for at åbne dets fulde detaljeside.",
      },
      callout: {
        kind: "tip",
        en: "If no results appear, your triggers may not have run yet. Triggers execute according to their configured schedule — daily at your chosen time, or weekly on your chosen day.",
        da: "Hvis der ikke vises resultater, er dine triggers måske ikke kørt endnu. Triggers udføres efter deres konfigurerede tidsplan — dagligt på det valgte tidspunkt eller ugentligt på den valgte dag.",
      },
    },
  ],
};
