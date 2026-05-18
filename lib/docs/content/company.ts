import type { DocPage } from "../types";

export const companyDoc: DocPage = {
  slug: "company",
  title: { en: "Company Detail", da: "Virksomhedsdetalje" },
  description: {
    en: "Deep-dive into any Danish company — financials, AI briefings, outreach drafts, notes, tasks, and CRM sync.",
    da: "Dyk ned i enhver dansk virksomhed — økonomi, AI-briefings, opsøgningsudkast, noter, opgaver og CRM-synkronisering.",
  },
  heroScreenshot: {
    slug: "company/overview",
    alt: { en: "Company detail page", da: "Virksomhedsdetaljeside" },
  },
  sections: [
    {
      id: "financials",
      title: { en: "Financial data", da: "Økonomidata" },
      body: {
        en: "The financial panel displays the latest available figures from the company's annual reports filed with the Danish Business Authority. Data is sourced directly from the CVR register.",
        da: "Økonomipanelet viser de senest tilgængelige tal fra virksomhedens årsrapporter indberettet til Erhvervsstyrelsen. Data hentes direkte fra CVR-registeret.",
      },
      features: {
        en: [
          "Revenue (nettoomsætning) — last 3 years",
          "Gross profit (bruttoresultat)",
          "Net result (årets resultat)",
          "Equity (egenkapital)",
          "Employee count — reported vs. estimated",
        ],
        da: [
          "Omsætning (nettoomsætning) — seneste 3 år",
          "Bruttoprofit (bruttoresultat)",
          "Nettoresultat (årets resultat)",
          "Egenkapital",
          "Medarbejderantal — rapporteret vs. estimeret",
        ],
      },
      screenshot: {
        slug: "company/financials",
        alt: { en: "Company financial data panel", da: "Virksomhedens økonomidatapanel" },
      },
    },
    {
      id: "ai-briefing",
      title: { en: "AI briefing", da: "AI-briefing" },
      body: {
        en: "Click 'Generate briefing' to produce a 3–4 paragraph AI analysis of the company. The briefing covers what the company does, its financial health, growth signals, and notable characteristics — written in your selected language and adapted to your brand tone.",
        da: "Klik på 'Generér briefing' for at producere en 3–4 afsnits AI-analyse af virksomheden. Briefingen dækker, hvad virksomheden laver, dens finansielle sundhed, vækststignaler og bemærkelsesværdige karakteristika — skrevet på dit valgte sprog og tilpasset din brandtone.",
      },
      badge: "Pro",
      callout: {
        kind: "tip",
        en: "Set your brand tone in Settings → Brand to personalise how briefings are written. Options include formal, neutral, and casual.",
        da: "Indstil din brandtone i Indstillinger → Brand for at personalisere, hvordan briefings skrives. Mulighederne inkluderer formel, neutral og uformel.",
      },
      screenshot: {
        slug: "company/ai-briefing",
        alt: { en: "AI briefing panel", da: "AI-briefingpanel" },
      },
    },
    {
      id: "outreach-draft",
      title: { en: "Outreach draft", da: "Opsøgningsudkast" },
      body: {
        en: "Generate a personalised outreach email or LinkedIn message for this company in one click. The draft is grounded in the company's actual data and tailored to your brand tone and product description.",
        da: "Generér en personaliseret opsøgningsmail eller LinkedIn-besked til denne virksomhed med ét klik. Udkastet er baseret på virksomhedens faktiske data og tilpasset din brandtone og produktbeskrivelse.",
      },
      badge: "Pro",
      screenshot: {
        slug: "company/outreach-draft",
        alt: { en: "Outreach draft panel", da: "Opsøgningsudkastpanel" },
      },
    },
    {
      id: "notes",
      title: { en: "Notes", da: "Noter" },
      body: {
        en: "Add free-text notes to any company to track context, meeting outcomes, or follow-up reminders. Notes are private to your account (or shared within your team on Enterprise).",
        da: "Tilføj fritekstnoter til enhver virksomhed for at spore kontekst, møderesultater eller opfølgningspåmindelser. Noter er private for din konto (eller delt inden for dit team på Enterprise).",
      },
    },
    {
      id: "todos",
      title: { en: "Company tasks", da: "Virksomhedsopgaver" },
      body: {
        en: "Create tasks directly from a company's detail page. Tasks created here are automatically linked to the company and appear in your global Todos list with the company name as context.",
        da: "Opret opgaver direkte fra en virksomheds detaljeside. Opgaver oprettet her er automatisk knyttet til virksomheden og vises på din globale opgaveliste med firmanavnet som kontekst.",
      },
    },
    {
      id: "crm-push",
      title: { en: "CRM push", da: "CRM-push" },
      body: {
        en: "Push the company to your connected CRM (HubSpot, Pipedrive, or LeadConnector) as a new contact or company record. The push includes all available CVR data fields.",
        da: "Push virksomheden til din tilsluttede CRM (HubSpot, Pipedrive eller LeadConnector) som et nyt kontakt- eller firmaopslag. Pushen inkluderer alle tilgængelige CVR-datafelter.",
      },
      badge: "Pro",
    },
    {
      id: "followed-persons",
      title: { en: "Followed persons", da: "Fulgte personer" },
      body: {
        en: "Follow key individuals at a company — board members, owners, directors. CVR-MATE monitors their role across all registered companies and alerts you when they join, leave, or change roles.",
        da: "Følg nøglepersoner i en virksomhed — bestyrelsesmedlemmer, ejere, direktører. CVR-MATE overvåger deres rolle på tværs af alle registrerede virksomheder og advarer dig, når de tilslutter sig, forlader eller skifter roller.",
      },
      badge: "Pro",
    },
  ],
};
