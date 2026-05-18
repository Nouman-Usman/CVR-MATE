import type { DocPage } from "../types";

export const triggersDoc: DocPage = {
  slug: "triggers",
  title: { en: "Triggers", da: "Lead Triggers" },
  description: {
    en: "Automated lead alerts — define a filter set, set a schedule, and receive notifications when new companies match.",
    da: "Automatiserede lead-advarsler — definer et filtersæt, indstil en tidsplan, og modtag notifikationer, når nye virksomheder matcher.",
  },
  heroScreenshot: {
    slug: "triggers/overview",
    alt: { en: "Triggers page overview", da: "Triggers-sideoversigt" },
  },
  sections: [
    {
      id: "what-are-triggers",
      title: { en: "What are Triggers?", da: "Hvad er Triggers?" },
      body: {
        en: [
          "A Trigger is a saved search that runs automatically on a schedule. When the trigger finds companies that match its criteria and weren't matched on the previous run, it sends you a notification.",
          "Use Triggers to stay on top of new market entrants, companies reaching a revenue threshold, or any other criteria important to your sales process.",
        ],
        da: [
          "En Trigger er en gemt søgning, der kører automatisk efter en tidsplan. Når triggeren finder virksomheder, der matcher dens kriterier og ikke blev matchet ved den foregående kørsel, sender den dig en notifikation.",
          "Brug Triggers til at holde dig opdateret om nye markedsdeltagere, virksomheder der når en omsætningsgrænse eller ethvert andet kriterie, der er vigtigt for din salgsproces.",
        ],
      },
    },
    {
      id: "create-trigger",
      title: { en: "Creating a trigger", da: "Opret en trigger" },
      body: {
        en: "Click 'New trigger', enter a name, select a saved search as the filter source (or configure filters inline), and choose a schedule.",
        da: "Klik på 'Ny trigger', indtast et navn, vælg en gemt søgning som filterkilde (eller konfigurer filtre inline), og vælg en tidsplan.",
      },
      steps: {
        en: [
          "Click 'New trigger' in the top-right corner of the Triggers page.",
          "Enter a descriptive trigger name (e.g. 'New SaaS companies Copenhagen').",
          "Select an existing saved search or configure filters directly.",
          "Choose schedule: daily (select time) or weekly (select day + time).",
          "Select notification channels: in-app, email, or both.",
          "Click 'Create trigger' — it activates immediately.",
        ],
        da: [
          "Klik på 'Ny trigger' øverst til højre på Triggers-siden.",
          "Indtast et beskrivende triggernavn (f.eks. 'Nye SaaS-virksomheder København').",
          "Vælg en eksisterende gemt søgning eller konfigurer filtre direkte.",
          "Vælg tidsplan: daglig (vælg tidspunkt) eller ugentlig (vælg dag + tidspunkt).",
          "Vælg notifikationskanaler: in-app, e-mail eller begge.",
          "Klik på 'Opret trigger' — den aktiveres øjeblikkeligt.",
        ],
      },
      screenshot: {
        slug: "triggers/create-modal",
        alt: { en: "Create trigger modal", da: "Opret trigger-modal" },
      },
    },
    {
      id: "schedule",
      title: { en: "Schedule options", da: "Tidsplanmuligheder" },
      body: {
        en: "Triggers run either daily or weekly. Daily triggers execute at the time you specified in your timezone. Weekly triggers execute once per week on your chosen day.",
        da: "Triggers kører enten dagligt eller ugentligt. Daglige triggers udføres på det tidspunkt, du angav i din tidszone. Ugentlige triggers udføres én gang om ugen på din valgte dag.",
      },
      callout: {
        kind: "note",
        en: "Triggers are processed server-side via a scheduled job. The first execution happens at the next scheduled time after creation.",
        da: "Triggers behandles server-side via et planlagt job. Den første udførelse sker på det næste planlagte tidspunkt efter oprettelse.",
      },
    },
    {
      id: "notification-channels",
      title: { en: "Notification channels", da: "Notifikationskanaler" },
      body: {
        en: "Choose how you want to be notified when a trigger finds new matches.",
        da: "Vælg, hvordan du vil underrettes, når en trigger finder nye matches.",
      },
      features: {
        en: [
          "In-app — a badge on the notification bell in the top navigation bar",
          "Email — a daily lead update email listing matched companies with key stats",
          "Both — receive both in-app and email notifications simultaneously",
        ],
        da: [
          "In-app — et mærke på notifikationsklokken i den øverste navigationslinje",
          "E-mail — en daglig lead-opdateringsmail med matchede virksomheder og nøgletal",
          "Begge — modtag både in-app og e-mail-notifikationer samtidigt",
        ],
      },
    },
    {
      id: "trigger-results",
      title: { en: "Viewing trigger results", da: "Vis triggerresultater" },
      body: {
        en: "Expand any trigger in the list to see its most recent batch of matched companies. Each result shows company name, CVR, city, industry, and a direct link to the company detail page.",
        da: "Udvid en trigger i listen for at se dens seneste batch af matchede virksomheder. Hvert resultat viser firmanavn, CVR, by, branche og et direkte link til virksomhedsdetaljsiden.",
      },
      screenshot: {
        slug: "triggers/results",
        alt: { en: "Trigger results list", da: "Triggerresultatliste" },
      },
    },
  ],
};
