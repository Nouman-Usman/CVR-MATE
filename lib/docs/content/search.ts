import type { DocPage } from "../types";

export const searchDoc: DocPage = {
  slug: "search",
  title: { en: "Search", da: "Søg virksomheder" },
  description: {
    en: "Find any Danish registered company using industry, location, size, financial, and legal-form filters.",
    da: "Find enhver dansk registreret virksomhed ved hjælp af branche-, lokations-, størrelses-, økonomi- og selskabsformsfiltre.",
  },
  heroScreenshot: {
    slug: "search/overview",
    alt: { en: "Search page overview", da: "Søgesideoversigt" },
  },
  sections: [
    {
      id: "filters",
      title: { en: "Filters", da: "Filtre" },
      body: {
        en: "The filter sidebar on the left lets you narrow the full CVR register to the exact companies you care about. All filters combine with AND logic — each additional filter narrows the result set further.",
        da: "Filtersidebjælken til venstre lader dig indsnævre hele CVR-registeret til præcis de virksomheder, du interesserer dig for. Alle filtre kombineres med AND-logik — hvert ekstra filter indsnævrer resultatsættet yderligere.",
      },
      features: {
        en: [
          "Industry — filter by NACE/DB07 industry code or free-text keyword",
          "Company form — ApS, A/S, I/S, Enkeltmandsvirksomhed, and more",
          "Location — city name or postal code",
          "Founded — date range for company registration date",
          "Employees — min/max slider for headcount",
          "Revenue — min/max slider (DKK thousands)",
          "Gross profit — min/max slider (DKK thousands)",
        ],
        da: [
          "Branche — filtrer efter NACE/DB07-branchekode eller fritekst",
          "Selskabsform — ApS, A/S, I/S, Enkeltmandsvirksomhed og mere",
          "Lokation — bynavn eller postnummer",
          "Stiftet — datointerval for selskabets registreringsdato",
          "Medarbejdere — min/maks-skyder for medarbejderantal",
          "Omsætning — min/maks-skyder (DKK tusinder)",
          "Bruttoprofit — min/maks-skyder (DKK tusinder)",
        ],
      },
      screenshot: {
        slug: "search/filters-panel",
        alt: { en: "Search filters sidebar", da: "Søgefiltre sidebjælke" },
      },
    },
    {
      id: "dissolved-toggle",
      title: { en: "Dissolved companies toggle", da: "Opløste virksomheder" },
      body: {
        en: "By default, search results exclude dissolved (ophørt) companies. Toggle 'Show dissolved' at the bottom of the filter panel to include them. Dissolved companies appear with an amber background tint and an 'Opløst' badge.",
        da: "Som standard udelukker søgeresultater opløste virksomheder. Slå 'Vis opløste' til nederst i filterpanelet for at inkludere dem. Opløste virksomheder vises med en amber baggrundstone og et 'Opløst'-mærke.",
      },
      callout: {
        kind: "note",
        en: "Dissolved companies can be useful for competitive research — finding former clients of a competitor, for example.",
        da: "Opløste virksomheder kan være nyttige til konkurrenceforskning — for eksempel til at finde tidligere kunder hos en konkurrent.",
      },
    },
    {
      id: "results-table",
      title: { en: "Results table", da: "Resultattabel" },
      body: {
        en: "Search results are displayed as a dense table with key data visible per row: company name, CVR number, city, industry, company form, employee count, and status. Hover any row to reveal the save (♥) button.",
        da: "Søgeresultater vises som en kompakt tabel med nøgledata synlig pr. række: firmanavn, CVR-nummer, by, branche, selskabsform, medarbejderantal og status. Hover over en række for at afsløre gem-knappen (♥).",
      },
      screenshot: {
        slug: "search/results-table",
        alt: { en: "Search results table", da: "Søgeresultattabel" },
      },
    },
    {
      id: "save-search",
      title: { en: "Saving a search", da: "Gem en søgning" },
      body: {
        en: "Click 'Save search' above the results to name and store your current filter combination. Saved searches appear in the Saved Searches page and can be used as the basis for a Trigger.",
        da: "Klik på 'Gem søgning' over resultaterne for at navngive og gemme din nuværende filterkombination. Gemte søgninger vises på siden Gemte søgninger og kan bruges som grundlag for en Trigger.",
      },
    },
    {
      id: "export-from-search",
      title: { en: "Exporting results", da: "Eksportér resultater" },
      body: {
        en: "Click the Export button to download the current result set as a CSV or XLSX file. The export respects all active filters and includes all columns visible in the table.",
        da: "Klik på Eksportér-knappen for at downloade det aktuelle resultatsæt som en CSV- eller XLSX-fil. Eksporten respekterer alle aktive filtre og inkluderer alle kolonner synlige i tabellen.",
      },
      badge: "Pro",
    },
  ],
};
