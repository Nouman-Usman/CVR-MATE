import type { DocPage } from "../types";

export const overviewDoc: DocPage = {
  slug: "overview",
  title: { en: "CVR-MATE Documentation", da: "CVR-MATE Dokumentation" },
  description: {
    en: "Everything you need to know to get the most out of CVR-MATE — Danish B2B lead intelligence.",
    da: "Alt du skal vide for at få mest muligt ud af CVR-MATE — dansk B2B lead intelligence.",
  },
  sections: [
    {
      id: "what-is-cvr-mate",
      title: { en: "What is CVR-MATE?", da: "Hvad er CVR-MATE?" },
      body: {
        en: [
          "CVR-MATE is a B2B lead intelligence platform built on the Danish Central Business Register (CVR). It gives sales and marketing teams instant access to detailed data on all registered Danish companies — financials, employee counts, industry codes, ownership structures, and more.",
          "Unlike generic databases, CVR-MATE layers AI-powered insights on top of raw register data: briefings, outreach drafts, and automated lead triggers that notify you the moment a company matching your criteria appears or changes.",
        ],
        da: [
          "CVR-MATE er en B2B lead intelligence platform bygget på det danske Centrale Virksomhedsregister (CVR). Det giver salgs- og marketingteams øjeblikkelig adgang til detaljerede data om alle registrerede danske virksomheder — økonomi, medarbejderantal, branchekoder, ejerstrukturer og mere.",
          "I modsætning til generiske databaser tilføjer CVR-MATE AI-drevne indsigter oven på rådata: briefings, opsøgningsudkast og automatiserede lead-triggers, der underretter dig, så snart en virksomhed, der matcher dine kriterier, dukker op eller ændrer sig.",
        ],
      },
    },
    {
      id: "quick-start",
      title: { en: "Quick start", da: "Hurtig start" },
      body: {
        en: "Follow these five steps to start generating qualified leads in under five minutes.",
        da: "Følg disse fem trin for at begynde at generere kvalificerede leads på under fem minutter.",
      },
      steps: {
        en: [
          "Sign up and complete the onboarding wizard — enter your company CVR and select your preferred communication tone.",
          "Go to Search and apply your first industry or location filter.",
          "Save the search — it becomes a reusable filter set you can revisit any time.",
          "Create a Trigger based on that saved search to receive daily notifications when new matching companies appear.",
          "Export matches to CSV or push them directly to your connected CRM.",
        ],
        da: [
          "Tilmeld dig og gennemfør onboarding-guiden — indtast dit firma-CVR og vælg din foretrukne kommunikationstil.",
          "Gå til Søgning og anvend dit første branche- eller lokationsfilter.",
          "Gem søgningen — den bliver et genanvendeligt filtersæt, du kan vende tilbage til når som helst.",
          "Opret en Trigger baseret på den gemte søgning for at modtage daglige notifikationer, når nye matchende virksomheder dukker op.",
          "Eksportér matches til CSV eller push dem direkte til din tilsluttede CRM.",
        ],
      },
    },
    {
      id: "plans",
      title: { en: "Plans overview", da: "Planoversigt" },
      body: {
        en: "CVR-MATE is available on three tiers. All plans include full CVR data access.",
        da: "CVR-MATE fås i tre niveauer. Alle planer inkluderer fuld CVR-dataadgang.",
      },
      features: {
        en: [
          "Starter — individual users, up to 3 saved searches, manual exports",
          "Pro — saved searches, triggers, AI briefings, CRM integrations, CSV/XLSX exports",
          "Enterprise — team workspaces, member roles, task assignment, audit logs, priority support",
        ],
        da: [
          "Starter — individuelle brugere, op til 3 gemte søgninger, manuelle eksporter",
          "Pro — gemte søgninger, triggers, AI-briefings, CRM-integrationer, CSV/XLSX-eksporter",
          "Enterprise — teamworkspaces, medlemsroller, opgavetildeling, auditlogs, prioritetssupport",
        ],
      },
      callout: {
        kind: "tip",
        en: "You can upgrade or downgrade your plan at any time from Settings → Subscription.",
        da: "Du kan opgradere eller nedgradere din plan til enhver tid fra Indstillinger → Abonnement.",
      },
    },
    {
      id: "feature-map",
      title: { en: "Feature map", da: "Funktionskort" },
      body: {
        en: "Use this table to find the documentation page for each feature.",
        da: "Brug denne tabel til at finde dokumentationssiden for hver funktion.",
      },
      features: {
        en: [
          "Search — find companies by industry, location, size, financials",
          "Triggers — automated daily/weekly lead alerts",
          "Saved Searches — reusable filter sets",
          "Company Detail — financials, AI briefing, notes, CRM push",
          "Saved Companies — tag, annotate, and bulk-manage companies",
          "Todos — task management linked to companies",
          "Exports — CSV/XLSX data exports",
          "Integrations — HubSpot, Pipedrive, LeadConnector",
          "Settings — profile, brand, team, billing",
        ],
        da: [
          "Søgning — find virksomheder efter branche, lokation, størrelse, økonomi",
          "Triggers — automatiserede daglige/ugentlige lead-advarsler",
          "Gemte søgninger — genanvendelige filtersæt",
          "Virksomhedsdetalje — økonomi, AI-briefing, noter, CRM-push",
          "Gemte virksomheder — tag, annotér og masseadministrer virksomheder",
          "Opgaver — opgavestyring knyttet til virksomheder",
          "Eksporter — CSV/XLSX-dataeksporter",
          "Integrationer — HubSpot, Pipedrive, LeadConnector",
          "Indstillinger — profil, brand, team, fakturering",
        ],
      },
    },
  ],
};
