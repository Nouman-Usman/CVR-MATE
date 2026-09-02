"use client";

import { LegalPageShell, type LegalSection } from "@/components/legal-page-shell";

/**
 * Data Processing Agreement (GDPR Article 28).
 *
 * DRAFT — REVIEW BY A DANISH DATA-PROTECTION LAWYER BEFORE PUBLISHING.
 *
 * Every factual statement below is taken from the code rather than from a
 * template: the encryption algorithms, the sub-processor list, the retention
 * periods and the deletion route are the ones actually implemented. The legal
 * commitments around those facts are Fourmates ApS's to make, not this file's
 * to invent.
 *
 * Consistency note: the sub-processor table here names Anthropic, because
 * `lib/ai/*` imports `@anthropic-ai/sdk` and `@google/genai` is not a
 * dependency. The published privacy policy still names Google (Gemini) and must
 * be corrected to match — two legal documents disagreeing about who processes
 * customer data is worse than either being wrong alone.
 */

const EFFECTIVE_DATE = "2. september 2026 / 2 September 2026";
const CONTACT_EMAIL = "support@cvr-mate.dk";

const sections: LegalSection[] = [
  {
    id: "d-1",
    daTitle: "Parterne og aftalens omfang",
    enTitle: "The parties and scope",
    content: (l) =>
      l === "da" ? (
        <>
          <p>
            Denne databehandleraftale (<strong>DPA</strong>) indgås mellem kunden
            (<strong>den dataansvarlige</strong>) og Fourmates ApS
            (<strong>databehandleren</strong>) og regulerer Fourmates ApS&apos; behandling af
            personoplysninger på kundens vegne i forbindelse med brugen af CVR-MATE.
          </p>
          <p className="mt-2">
            Aftalen udgør en databehandleraftale efter artikel 28 i forordning (EU) 2016/679
            (<strong>GDPR</strong>). Ved uoverensstemmelse mellem denne DPA og de generelle
            vilkår har denne DPA forrang for så vidt angår behandling af personoplysninger.
          </p>
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-5 text-sm space-y-1">
            <p className="font-semibold text-foreground">Fourmates ApS</p>
            <p className="text-muted-foreground">CVR-nr. 46256204</p>
            <p className="text-muted-foreground">Vindingvej 34, 7100 Vejle, Danmark</p>
            <p>
              Kontakt: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </div>
        </>
      ) : (
        <>
          <p>
            This Data Processing Agreement (<strong>DPA</strong>) is entered into between the
            customer (the <strong>controller</strong>) and Fourmates ApS (the{" "}
            <strong>processor</strong>) and governs Fourmates ApS&apos;s processing of personal
            data on the customer&apos;s behalf in connection with the use of CVR-MATE.
          </p>
          <p className="mt-2">
            It constitutes a data processing agreement under Article 28 of Regulation (EU)
            2016/679 (<strong>GDPR</strong>). In the event of a conflict between this DPA and
            the general terms, this DPA prevails in respect of the processing of personal data.
          </p>
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-5 text-sm space-y-1">
            <p className="font-semibold text-foreground">Fourmates ApS</p>
            <p className="text-muted-foreground">CVR no. 46256204</p>
            <p className="text-muted-foreground">Vindingvej 34, 7100 Vejle, Denmark</p>
            <p>
              Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </div>
        </>
      ),
  },
  {
    id: "d-2",
    daTitle: "Behandlingens genstand, varighed og formål",
    enTitle: "Subject matter, duration and purpose",
    content: (l) =>
      l === "da" ? (
        <>
          <p>
            <strong>Genstand:</strong> levering af CVR-MATE, herunder CRM-funktioner,
            kontaktstyring, tilbud og ordrer samt integrationer valgt af kunden.
          </p>
          <p className="mt-2">
            <strong>Varighed:</strong> så længe kundens abonnement består, med den sletning der
            følger af afsnittet om opbevaring og sletning.
          </p>
          <p className="mt-2">
            <strong>Formål:</strong> alene at levere Tjenesten efter kundens dokumenterede
            instruks. Fourmates ApS behandler ikke kundens personoplysninger til egne formål og
            sælger dem ikke.
          </p>
        </>
      ) : (
        <>
          <p>
            <strong>Subject matter:</strong> provision of CVR-MATE, including CRM features,
            contact management, quotes and orders, and integrations chosen by the customer.
          </p>
          <p className="mt-2">
            <strong>Duration:</strong> for as long as the customer&apos;s subscription is in
            effect, subject to the deletion described under retention and deletion.
          </p>
          <p className="mt-2">
            <strong>Purpose:</strong> solely to provide the Service on the customer&apos;s
            documented instructions. Fourmates ApS does not process customer personal data for
            its own purposes and does not sell it.
          </p>
        </>
      ),
  },
  {
    id: "d-3",
    daTitle: "Kategorier af registrerede og personoplysninger",
    enTitle: "Categories of data subjects and personal data",
    content: (l) => (
      <>
        <p>
          {l === "da"
            ? "Følgende kategorier behandles på kundens vegne. Listen afspejler de felter, systemet faktisk gemmer."
            : "The following categories are processed on the customer's behalf. The list reflects the fields the system actually stores."}
        </p>
        <div className="overflow-x-auto rounded-xl border border-border mt-3">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-foreground">
                  {l === "da" ? "Registrerede" : "Data subjects"}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">
                  {l === "da" ? "Oplysninger" : "Data"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              {(l === "da"
                ? [
                    ["Kundens brugere", "Navn, e-mail, rolle, sessions- og adgangslogge"],
                    [
                      "Kontaktpersoner hos kundens kunder og emner",
                      "Navn, titel, e-mail, telefon, LinkedIn, fritekstnoter",
                    ],
                    [
                      "Personer i CVR-registret",
                      "Navn, roller og tilknytninger som offentliggjort i CVR",
                    ],
                    ["Modtagere af dokumenter", "Navn og e-mail på tilbud og ordrer"],
                  ]
                : [
                    ["The customer's users", "Name, email, role, session and access logs"],
                    [
                      "Contacts at the customer's clients and prospects",
                      "Name, title, email, phone, LinkedIn, free-text notes",
                    ],
                    [
                      "Individuals in the CVR register",
                      "Name, roles and affiliations as published in the Danish CVR register",
                    ],
                    ["Document recipients", "Name and email on quotes and orders"],
                  ]
              ).map(([who, what]) => (
                <tr key={who}>
                  <td className="px-4 py-3 font-medium text-foreground">{who}</td>
                  <td className="px-4 py-3">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs">
          {l === "da"
            ? "Tjenesten er ikke beregnet til særlige kategorier af personoplysninger efter GDPR artikel 9 eller til oplysninger om strafbare forhold, og kunden må ikke indlæse sådanne oplysninger."
            : "The Service is not intended for special categories of personal data under GDPR Article 9, nor for criminal-offence data, and the customer must not upload such data."}
        </p>
      </>
    ),
  },
  {
    id: "d-4",
    daTitle: "Tekniske og organisatoriske sikkerhedsforanstaltninger",
    enTitle: "Technical and organisational security measures",
    content: (l) => (
      <>
        <p>
          {l === "da"
            ? "Foranstaltningerne nedenfor er dem, der er implementeret i produktet, jf. GDPR artikel 32:"
            : "The measures below are those implemented in the product, pursuant to GDPR Article 32:"}
        </p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          {(l === "da"
            ? [
                "Kryptering af følsomme felter i hvile med AES-256-GCM (kontakters e-mail, telefon, LinkedIn og noter samt interaktionstekster).",
                "Blindt indeks (HMAC-SHA256) til opslag på e-mail og telefon, så søgning ikke kræver dekryptering.",
                "Kryptering af integrationstokens, herunder bogføringssystemers adgangstokens, med en separat nøgle.",
                "Kryptering under overførsel via TLS på alle forbindelser.",
                "Adgangskontrol pr. organisation: alle organisationsdata er afgrænset af organisations-id, og rolleadgang er ejer, administrator og medlem.",
                "Revisionslog over organisationshændelser og en aktivitetslog over ændringer af forretningsdata.",
                "Rate limiting på autentificerings- og invitationsendepunkter.",
            ]
            : [
                "Encryption of sensitive fields at rest using AES-256-GCM (contact email, phone, LinkedIn and notes, and interaction bodies).",
                "Blind indexes (HMAC-SHA256) for email and phone lookup, so search does not require decryption.",
                "Encryption of integration tokens, including bookkeeping system access tokens, under a separate key.",
                "Encryption in transit via TLS on all connections.",
                "Per-organization access control: all organization data is scoped by organization id, with owner, admin and member roles.",
                "An audit log of organization events and an activity log of business-data changes.",
                "Rate limiting on authentication and invitation endpoints.",
              ]
          ).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: "d-5",
    daTitle: "Underdatabehandlere",
    enTitle: "Sub-processors",
    content: (l) => (
      <>
        <p>
          {l === "da"
            ? "Kunden giver generel forhåndsgodkendelse til nedenstående underdatabehandlere. Fourmates ApS varsler ændringer i rimelig tid, så kunden kan gøre indsigelse."
            : "The customer gives general prior authorisation to the sub-processors below. Fourmates ApS will give reasonable notice of changes so the customer may object."}
        </p>
        <div className="overflow-x-auto rounded-xl border border-border mt-3">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-foreground">
                  {l === "da" ? "Leverandør" : "Vendor"}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">
                  {l === "da" ? "Formål" : "Purpose"}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">
                  {l === "da" ? "Placering" : "Location"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              {(l === "da"
                ? [
                    ["Supabase", "Database og fillagring", "EU (London, eu-west-2)"],
                    ["Vercel, Inc.", "Hosting og CDN", "EU/USA (SCC)"],
                    ["Upstash", "Cache, rate limiting og jobkø", "EU"],
                    ["Anthropic, PBC", "AI-funktioner (briefinger, udkast, forslag)", "USA (SCC)"],
                    ["Resend", "Transaktionelle e-mails", "USA (SCC)"],
                    ["Stripe, Inc.", "Betalingsbehandling", "USA (SCC/DPF)"],
                    ["Sentry, Inc.", "Fejl- og performanceovervågning", "USA (SCC)"],
                  ]
                : [
                    ["Supabase", "Database and file storage", "EU (London, eu-west-2)"],
                    ["Vercel, Inc.", "Hosting and CDN", "EU/USA (SCCs)"],
                    ["Upstash", "Cache, rate limiting and job queue", "EU"],
                    ["Anthropic, PBC", "AI features (briefings, drafts, suggestions)", "USA (SCCs)"],
                    ["Resend", "Transactional emails", "USA (SCCs)"],
                    ["Stripe, Inc.", "Payment processing", "USA (SCCs/DPF)"],
                    ["Sentry, Inc.", "Error and performance monitoring", "USA (SCCs)"],
                  ]
              ).map(([vendor, purpose, location]) => (
                <tr key={vendor}>
                  <td className="px-4 py-3 font-medium text-foreground">{vendor}</td>
                  <td className="px-4 py-3">{purpose}</td>
                  <td className="px-4 py-3">{location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs">
          {l === "da"
            ? "Bogføringssystemer (e-conomic) og CRM-systemer, som kunden selv forbinder, er ikke underdatabehandlere. Kunden er dataansvarlig for den overførsel, og forholdet reguleres af kundens aftale med den pågældende leverandør."
            : "Bookkeeping systems (e-conomic) and CRM systems that the customer connects themselves are not sub-processors. The customer is the controller for that transfer, and the relationship is governed by the customer's own agreement with that vendor."}
        </p>
      </>
    ),
  },
  {
    id: "d-6",
    daTitle: "AI-behandling",
    enTitle: "AI processing",
    content: (l) => (
      <>
        <p>
          {l === "da"
            ? "AI-funktionerne kalder Anthropics API. Kundedata sendes kun, når en bruger udløser en AI-funktion, og bruges ikke til at træne modeller."
            : "AI features call Anthropic's API. Customer data is sent only when a user triggers an AI feature, and is not used to train models."}
        </p>
        <p className="mt-2">
          {l === "da"
            ? "Faktureringsintegrationen bruger ikke AI. En ordre bliver til et fakturaudkast ved en direkte dataoverførsel til bogføringssystemet — ingen model er involveret."
            : "The invoicing integration uses no AI. An order becomes a draft invoice through a direct data transfer to the bookkeeping system — no model is involved."}
        </p>
      </>
    ),
  },
  {
    id: "d-7",
    daTitle: "Opbevaring og sletning",
    enTitle: "Retention and deletion",
    content: (l) => (
      <>
        <ul className="list-disc pl-6 space-y-1">
          {(l === "da"
            ? [
                "Aktivitetslog: 90 dage.",
                "E-mail-log: 90 dage.",
                "Organisationens revisionslog: 365 dage.",
                "Læste notifikationer: 30 dage.",
                "Blødt slettede CRM-poster: 30 dages frist, derefter endelig sletning.",
                "Kundedata i øvrigt: så længe abonnementet består.",
              ]
            : [
                "Activity log: 90 days.",
                "Email log: 90 days.",
                "Organization audit log: 365 days.",
                "Read notifications: 30 days.",
                "Soft-deleted CRM records: a 30-day grace period, then permanent deletion.",
                "Other customer data: for the duration of the subscription.",
              ]
          ).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3">
          {l === "da"
            ? "En bruger kan slette sin konto i produktet, hvorefter personlige data fjernes. Delt organisationsindhold består, men forfatteren anonymiseres."
            : "A user can delete their account in the product, after which personal data is removed. Shared organization content remains, but its author is anonymised."}
        </p>
      </>
    ),
  },
  {
    id: "d-8",
    daTitle: "Bistand, brud og revision",
    enTitle: "Assistance, breaches and audits",
    content: (l) =>
      l === "da" ? (
        <>
          <p>
            Fourmates ApS bistår kunden med at besvare anmodninger fra registrerede og med
            forpligtelserne efter GDPR artikel 32–36, i det omfang det er nødvendigt og muligt.
          </p>
          <p className="mt-2">
            Ved brud på persondatasikkerheden underrettes kunden uden unødig forsinkelse efter
            at Fourmates ApS er blevet bekendt med bruddet, med de oplysninger der er
            tilgængelige.
          </p>
          <p className="mt-2">
            Fourmates ApS stiller de oplysninger til rådighed, der er nødvendige for at påvise
            overholdelse af artikel 28, og muliggør revision efter forudgående skriftlig aftale.
          </p>
        </>
      ) : (
        <>
          <p>
            Fourmates ApS assists the customer in responding to data-subject requests and with
            the obligations in GDPR Articles 32–36, to the extent necessary and possible.
          </p>
          <p className="mt-2">
            In the event of a personal data breach, the customer is notified without undue delay
            after Fourmates ApS becomes aware of it, with the information available.
          </p>
          <p className="mt-2">
            Fourmates ApS makes available the information necessary to demonstrate compliance
            with Article 28 and allows for audits by prior written arrangement.
          </p>
        </>
      ),
  },
  {
    id: "d-9",
    daTitle: "Ophør",
    enTitle: "Termination",
    content: (l) => (
      <p>
        {l === "da"
          ? "Ved ophør sletter Fourmates ApS personoplysninger behandlet på kundens vegne, medmindre opbevaring kræves efter EU-ret eller dansk ret. Kunden kan inden ophør eksportere sine data fra produktet."
          : "On termination, Fourmates ApS deletes personal data processed on the customer's behalf, unless retention is required by EU or Danish law. Before termination the customer may export their data from the product."}
      </p>
    ),
  },
];

export function DpaContent() {
  return (
    <LegalPageShell
      page="privacy"
      daTitle="Databehandleraftale"
      enTitle="Data Processing Agreement"
      daSubtitle="Fourmates ApS' behandling af personoplysninger på kundens vegne, jf. GDPR artikel 28."
      enSubtitle="Fourmates ApS's processing of personal data on the customer's behalf, pursuant to GDPR Article 28."
      effectiveDate={EFFECTIVE_DATE}
      sections={sections}
    />
  );
}
