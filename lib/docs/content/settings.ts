import type { DocPage } from "../types";

export const settingsDoc: DocPage = {
  slug: "settings",
  title: { en: "Settings", da: "Indstillinger" },
  description: {
    en: "Manage your profile, brand identity, team, notifications, integrations, and billing.",
    da: "Administrer din profil, brandidentitet, team, notifikationer, integrationer og fakturering.",
  },
  sections: [
    {
      id: "profile",
      title: { en: "Profile", da: "Profil" },
      body: {
        en: "Update your display name and manage your account email. Your email is used for login and system notifications.",
        da: "Opdater dit visningsnavn og administrer din konto-e-mail. Din e-mail bruges til login og systemnotifikationer.",
      },
    },
    {
      id: "password",
      title: { en: "Password", da: "Adgangskode" },
      body: {
        en: "Change your account password. Enter your current password, then your new password twice. Passwords must be at least 8 characters.",
        da: "Skift din kontoadgangskode. Indtast din nuværende adgangskode, derefter din nye adgangskode to gange. Adgangskoder skal være mindst 8 tegn.",
      },
    },
    {
      id: "brand",
      title: { en: "Brand & tone", da: "Brand & tone" },
      body: {
        en: "The brand profile powers all AI-generated content — briefings, outreach drafts, and pipeline analyses. Set it once and all AI output adapts to your company voice.",
        da: "Brandprofilen driver alt AI-genereret indhold — briefings, opsøgningsudkast og pipeline-analyser. Indstil det én gang, og alt AI-output tilpasser sig din firmastemme.",
      },
      features: {
        en: [
          "Company name — your organisation's trading name",
          "Industry — your own company's sector (helps contextualise outreach)",
          "Product/service description — what you sell (used in outreach drafts)",
          "Communication tone — Formal, Neutral, or Casual",
        ],
        da: [
          "Firmanavn — din organisations handelsnavn",
          "Branche — din egen virksomheds sektor (hjælper med at kontekstualisere opsøgning)",
          "Produkt/servicebeskrivelse — hvad du sælger (bruges i opsøgningsudkast)",
          "Kommunikationstilstand — Formel, Neutral eller Uformel",
        ],
      },
      screenshot: {
        slug: "settings/brand",
        alt: { en: "Brand settings panel", da: "Brandindstillingspanel" },
      },
    },
    {
      id: "team",
      title: { en: "Team management", da: "Teamadministration" },
      body: {
        en: "Invite team members by email, assign roles (Owner, Admin, Member), and remove access when someone leaves. All team members share the same saved companies, triggers, and saved searches within the workspace.",
        da: "Invitér teammedlemmer via e-mail, tildel roller (Ejer, Admin, Medlem) og fjern adgang, når nogen forlader teamet. Alle teammedlemmer deler de samme gemte virksomheder, triggers og gemte søgninger inden for workspacet.",
      },
      badge: "Enterprise",
      screenshot: {
        slug: "settings/team",
        alt: { en: "Team management page", da: "Teamadministrationsside" },
      },
    },
    {
      id: "notifications",
      title: { en: "Notifications", da: "Notifikationer" },
      body: {
        en: "Control which types of notifications you receive and through which channels.",
        da: "Kontrollér, hvilke typer notifikationer du modtager og gennem hvilke kanaler.",
      },
      features: {
        en: [
          "Email notifications — master toggle for all email alerts",
          "Daily lead update emails — per-trigger email when new matches are found",
          "Weekly summary emails — digest of activity across all triggers",
        ],
        da: [
          "E-mailnotifikationer — hovedafbryder for alle e-mailadvarsler",
          "Daglige lead-opdateringsemails — pr. trigger e-mail, når nye matches er fundet",
          "Ugentlige sammenfatningsemails — oversigt over aktivitet på tværs af alle triggers",
        ],
      },
    },
    {
      id: "language",
      title: { en: "Language", da: "Sprog" },
      body: {
        en: "Switch the platform interface between Danish and English. Your language preference is saved to your account and applied across all devices. System emails (verification, notifications) are also sent in your chosen language.",
        da: "Skift platformsgrænsefladen mellem dansk og engelsk. Din sprogpræference gemmes på din konto og anvendes på tværs af alle enheder. Systeme-mails (bekræftelse, notifikationer) sendes også på dit valgte sprog.",
      },
    },
    {
      id: "billing",
      title: { en: "Billing & subscription", da: "Fakturering & abonnement" },
      body: {
        en: "View your current plan, manage your payment method, and upgrade or downgrade. Billing is handled by Stripe — CVR-MATE never stores card details.",
        da: "Se din nuværende plan, administrer din betalingsmetode og opgradér eller nedgradér. Fakturering håndteres af Stripe — CVR-MATE gemmer aldrig kortoplysninger.",
      },
      screenshot: {
        slug: "settings/billing",
        alt: { en: "Billing settings", da: "Faktureringsindstillinger" },
      },
    },
    {
      id: "danger-zone",
      title: { en: "Danger zone", da: "Farezon" },
      body: {
        en: "Permanently delete your account and all associated data. This action cannot be undone. Your Stripe subscription is cancelled immediately upon account deletion.",
        da: "Slet permanent din konto og alle tilknyttede data. Denne handling kan ikke fortrydes. Dit Stripe-abonnement annulleres øjeblikkeligt ved kontosletning.",
      },
      callout: {
        kind: "warning",
        en: "Account deletion is irreversible. All saved companies, triggers, searches, notes, and tasks are permanently removed.",
        da: "Kontosletning er uigenkaldelig. Alle gemte virksomheder, triggers, søgninger, noter og opgaver fjernes permanent.",
      },
    },
  ],
};
