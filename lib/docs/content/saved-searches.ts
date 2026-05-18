import type { DocPage } from "../types";

export const savedSearchesDoc: DocPage = {
  slug: "saved-searches",
  title: { en: "Saved Searches", da: "Gemte søgninger" },
  description: {
    en: "Store and reuse filter combinations. Saved searches are the foundation for Triggers.",
    da: "Gem og genbrug filterkombinationer. Gemte søgninger er grundlaget for Triggers.",
  },
  sections: [
    {
      id: "creating-a-saved-search",
      title: { en: "Creating a saved search", da: "Opret en gemt søgning" },
      body: {
        en: "After applying filters on the Search page, click 'Save search' and enter a descriptive name. The search is stored with all current filter values.",
        da: "Efter at have anvendt filtre på søgesiden skal du klikke på 'Gem søgning' og indtaste et beskrivende navn. Søgningen gemmes med alle aktuelle filterværdier.",
      },
    },
    {
      id: "running-a-saved-search",
      title: { en: "Running a saved search", da: "Kør en gemt søgning" },
      body: {
        en: "From the Saved Searches page, click 'Run search' on any row to navigate back to the Search page with those filters pre-applied. Results reflect the current CVR register state, not a snapshot from when the search was saved.",
        da: "Fra siden Gemte søgninger skal du klikke på 'Kør søgning' på en række for at navigere tilbage til søgesiden med disse filtre forudindstillet. Resultater afspejler den aktuelle CVR-registertilstand, ikke et snapshot fra da søgningen blev gemt.",
      },
      callout: {
        kind: "info",
        en: "Saved searches always query live data. The filter criteria are stored, not the results.",
        da: "Gemte søgninger forespørger altid live data. Filterkriterierne gemmes, ikke resultaterne.",
      },
    },
    {
      id: "filter-badges",
      title: { en: "Filter badges", da: "Filtermærker" },
      body: {
        en: "Each saved search row displays the active filters as compact badges — industry, location, company form, and range values — so you can identify the search at a glance without opening it.",
        da: "Hver gemt søgningsrække viser de aktive filtre som kompakte mærker — branche, lokation, selskabsform og intervalværdier — så du kan identificere søgningen på ét blik uden at åbne den.",
      },
    },
    {
      id: "using-with-triggers",
      title: { en: "Using with Triggers", da: "Brug med Triggers" },
      body: {
        en: "Saved searches are the primary way to configure a Trigger. When creating a trigger, select an existing saved search as the filter source. The trigger will run that search on its schedule and notify you of new matches.",
        da: "Gemte søgninger er den primære måde at konfigurere en Trigger på. Når du opretter en trigger, skal du vælge en eksisterende gemt søgning som filterkilde. Triggeren vil køre den søgning efter sin tidsplan og underrette dig om nye matches.",
      },
    },
  ],
};
