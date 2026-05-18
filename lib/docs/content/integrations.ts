import type { DocPage } from "../types";

export const integrationsDoc: DocPage = {
  slug: "integrations",
  title: { en: "Integrations", da: "Integrationer" },
  description: {
    en: "Connect CVR-MATE to HubSpot, Pipedrive, or LeadConnector to push companies directly to your CRM.",
    da: "Forbind CVR-MATE til HubSpot, Pipedrive eller LeadConnector for at pushe virksomheder direkte til din CRM.",
  },
  sections: [
    {
      id: "supported-crms",
      title: { en: "Supported CRMs", da: "Understøttede CRM'er" },
      body: {
        en: "CVR-MATE currently supports three CRM platforms. All integrations use OAuth 2.0 — no API keys to manage.",
        da: "CVR-MATE understøtter i øjeblikket tre CRM-platforme. Alle integrationer bruger OAuth 2.0 — ingen API-nøgler at administrere.",
      },
      features: {
        en: [
          "HubSpot — push as Contact or Company record",
          "Pipedrive — push as Person or Organisation",
          "LeadConnector — push as Contact",
        ],
        da: [
          "HubSpot — push som Kontakt- eller Firmaopslag",
          "Pipedrive — push som Person eller Organisation",
          "LeadConnector — push som Kontakt",
        ],
      },
      badge: "Pro",
    },
    {
      id: "connecting-hubspot",
      title: { en: "Connecting HubSpot", da: "Forbind HubSpot" },
      body: {
        en: "Go to Settings → Integrations and click 'Connect HubSpot'. You'll be redirected to HubSpot's OAuth consent screen. Grant access and you'll be returned to CVR-MATE with the integration active.",
        da: "Gå til Indstillinger → Integrationer og klik på 'Forbind HubSpot'. Du omdirigeres til HubSpots OAuth-samtykkeskærm. Giv adgang, og du vil blive returneret til CVR-MATE med integrationen aktiv.",
      },
      steps: {
        en: [
          "Open Settings → Integrations.",
          "Click 'Connect' under the HubSpot card.",
          "Log in to HubSpot if prompted, then click 'Grant access'.",
          "You are redirected back to CVR-MATE — the card shows 'Connected'.",
          "Push any company using the CRM Push button on its detail page.",
        ],
        da: [
          "Åbn Indstillinger → Integrationer.",
          "Klik på 'Forbind' under HubSpot-kortet.",
          "Log ind på HubSpot, hvis du bliver bedt om det, og klik derefter på 'Giv adgang'.",
          "Du omdirigeres tilbage til CVR-MATE — kortet viser 'Forbundet'.",
          "Push enhver virksomhed ved hjælp af CRM Push-knappen på dens detaljeside.",
        ],
      },
      screenshot: {
        slug: "integrations/hubspot",
        alt: { en: "HubSpot connection flow", da: "HubSpot forbindelsesflow" },
      },
    },
    {
      id: "connecting-pipedrive",
      title: { en: "Connecting Pipedrive", da: "Forbind Pipedrive" },
      body: {
        en: "The Pipedrive connection follows the same OAuth flow as HubSpot. Go to Settings → Integrations, click 'Connect Pipedrive', and authorise the app in the Pipedrive OAuth screen.",
        da: "Pipedrive-forbindelsen følger det samme OAuth-flow som HubSpot. Gå til Indstillinger → Integrationer, klik på 'Forbind Pipedrive', og godkend appen på Pipedrives OAuth-skærm.",
      },
      screenshot: {
        slug: "integrations/pipedrive",
        alt: { en: "Pipedrive connection", da: "Pipedrive forbindelse" },
      },
    },
    {
      id: "sync-behavior",
      title: { en: "Sync behaviour", da: "Synkroniseringsadfærd" },
      body: {
        en: "CVR-MATE pushes data to your CRM on demand — there is no continuous background sync. Each push creates a new record. Duplicate detection is handled by your CRM's built-in deduplication rules.",
        da: "CVR-MATE pusher data til din CRM efter behov — der er ingen kontinuerlig baggrundssync. Hvert push opretter et nyt opslag. Duplikatdetektering håndteres af din CRMs indbyggede dedupliceringsregler.",
      },
      callout: {
        kind: "warning",
        en: "Pushing the same company twice will create a duplicate record in your CRM unless your CRM deduplication is configured to catch it.",
        da: "At pushe den samme virksomhed to gange vil oprette et duplikatopslag i din CRM, medmindre din CRM-deduplicering er konfigureret til at fange det.",
      },
    },
    {
      id: "disconnecting",
      title: { en: "Disconnecting a CRM", da: "Afbryd en CRM" },
      body: {
        en: "Go to Settings → Integrations and click 'Disconnect' under the connected CRM. This revokes CVR-MATE's access token. Previously pushed records in your CRM are not affected.",
        da: "Gå til Indstillinger → Integrationer og klik på 'Afbryd' under den tilsluttede CRM. Dette tilbagekalder CVR-MATEs adgangstoken. Tidligere pushede opslag i din CRM påvirkes ikke.",
      },
    },
  ],
};
