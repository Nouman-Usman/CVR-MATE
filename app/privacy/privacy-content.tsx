"use client";

import Link from "next/link";
import { LegalPageShell, type LegalSection } from "@/components/legal-page-shell";

const EFFECTIVE_DATE = "6. maj 2026 / 6 May 2026";
const CONTACT_EMAIL = "support@cvr-mate.dk";
const DPA_EMAIL = "support@cvr-mate.dk";

// ─── Bilingual section content ────────────────────────────────────────────────

const sections: LegalSection[] = [
  {
    id: "p-1",
    daTitle: "Dataansvarlig",
    enTitle: "Data controller",
    content: (l) =>
      l === "da" ? (
        <>
          <p>
            Fourmates ApS er dataansvarlig for behandlingen af de personoplysninger, som er beskrevet i denne privatlivspolitik. CVR-MATE er produktnavnet; den juridiske ansvarlige enhed er Fourmates ApS. Vi behandler personoplysninger i overensstemmelse med Europa-Parlamentets og Rådets forordning (EU) 2016/679 (<strong>GDPR</strong>) og den danske databeskyttelseslov.
          </p>
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-5 text-sm space-y-1">
            <p className="font-semibold text-foreground">Fourmates ApS</p>
            <p className="text-muted-foreground">CVR-nr. 46256204</p>
            <p className="text-muted-foreground">Vindingvej 34, 7100 Vejle, Danmark</p>
            <p>Kontakt: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
          </div>
        </>
      ) : (
        <>
          <p>
            Fourmates ApS is the data controller for the processing of personal data described in this Privacy Policy. CVR-MATE is the product name; the legal responsible entity is Fourmates ApS. We process personal data in accordance with Regulation (EU) 2016/679 (<strong>GDPR</strong>) and Danish data protection law.
          </p>
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-5 text-sm space-y-1">
            <p className="font-semibold text-foreground">Fourmates ApS</p>
            <p className="text-muted-foreground">CVR no. 46256204</p>
            <p className="text-muted-foreground">Vindingvej 34, 7100 Vejle, Denmark</p>
            <p>Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
          </div>
        </>
      ),
  },
  {
    id: "p-gdpr-roles",
    daTitle: "GDPR-roller",
    enTitle: "GDPR roles",
    content: (l) =>
      l === "da" ? (
        <>
          <p>Afhængigt af konteksten optræder Fourmates ApS i forskellige GDPR-roller:</p>
          <h3 className="mt-4">Fourmates ApS som dataansvarlig</h3>
          <p>Fourmates ApS er dataansvarlig for behandlingen af:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Kontodata og brugerprofiloplysninger</li>
            <li>Betalingsdata og faktureringshistorik</li>
            <li>Supportkommunikation</li>
            <li>Anonymiserede analytiske data og fejllogge (Sentry, Vercel)</li>
            <li>Sikkerhedslogge og adgangslogge til platformsdrift</li>
          </ul>
          <h3 className="mt-4">Fourmates ApS som databehandler</h3>
          <p>Når du bruger CVR-MATE til at behandle dine egne kundedata, fungerer Fourmates ApS som databehandler på dine vegne. Dette gælder for:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Gemte leads og virksomheder i dit workspace</li>
            <li>CRM-sync og dataeksport til HubSpot, Pipedrive eller LeadConnector</li>
            <li>Noter, tags, triggers og todo-elementer</li>
          </ul>
          <p className="mt-2">Du er i den forbindelse dataansvarlig og bærer det fulde ansvar for behandlingsgrundlaget. En databehandleraftale (DPA) er tilgængelig — se afsnit 12.</p>
          <h3 className="mt-4">Du som dataansvarlig</h3>
          <p>For data du eksporterer og anvender til outreach, markedsføring, telefonisk kontakt, LinkedIn-kontakt eller CRM-berikning er du alene dataansvarlig. Du er ansvarlig for at sikre et gyldigt retsgrundlag for behandlingen og for overholdelse af GDPR og den danske markedsføringslov.</p>
        </>
      ) : (
        <>
          <p>Depending on context, Fourmates ApS operates in different GDPR roles:</p>
          <h3 className="mt-4">Fourmates ApS as data controller</h3>
          <p>Fourmates ApS is data controller for the processing of:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Account data and user profile information</li>
            <li>Payment data and billing history</li>
            <li>Support communications</li>
            <li>Anonymised analytics data and error logs (Sentry, Vercel)</li>
            <li>Security logs and access logs for platform operations</li>
          </ul>
          <h3 className="mt-4">Fourmates ApS as data processor</h3>
          <p>When you use CVR-MATE to process your own customer data, Fourmates ApS acts as data processor on your behalf. This applies to:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Saved leads and companies in your workspace</li>
            <li>CRM sync and data exports to HubSpot, Pipedrive or LeadConnector</li>
            <li>Notes, tags, triggers and to-do items</li>
          </ul>
          <p className="mt-2">In this context you are the data controller and bear full responsibility for the processing basis. A Data Processing Agreement (DPA) is available — see Section 12.</p>
          <h3 className="mt-4">You as data controller</h3>
          <p>For data you export and use for outreach, marketing, telephone contact, LinkedIn contact or CRM enrichment, you are the sole data controller. You are responsible for ensuring a valid legal basis for processing and for compliance with GDPR and the Danish Marketing Practices Act.</p>
        </>
      ),
  },
  {
    id: "p-2",
    daTitle: "Hvilke data vi indsamler",
    enTitle: "What data we collect",
    content: (l) =>
      l === "da" ? (
        <>
          <h3>2.1 Data du giver os</h3>
          <ul className="list-disc pl-6 space-y-1.5 mt-2">
            <li><strong>Kontooplysninger:</strong> Navn, e-mailadresse og adgangskode (hashed) ved registrering</li>
            <li><strong>Profiloplysninger:</strong> Virksomhedsnavn, branding-indstillinger og sprogpræferencer</li>
            <li><strong>Betalingsoplysninger:</strong> Faktureringsadresse og abonnementshistorik (kortdata behandles udelukkende af Stripe)</li>
            <li><strong>Brugerindhold:</strong> Gemte virksomheder, noter, søgninger, triggers og todo-elementer</li>
            <li><strong>Kommunikation:</strong> E-mails sendt til vores support</li>
          </ul>
          <h3>2.2 Data vi indsamler automatisk</h3>
          <ul className="list-disc pl-6 space-y-1.5 mt-2">
            <li><strong>Log-data:</strong> IP-adresse, browser-type, sider besøgt og tidsstempler</li>
            <li><strong>Brugsmønstre:</strong> Hvilke funktioner du anvender og hyppighed</li>
            <li><strong>Fejlrapporter:</strong> Anonymiserede stack traces via Sentry til fejlfinding</li>
            <li><strong>Ydelsesdata:</strong> Sideindlæsningstider via Vercel Speed Insights (kun med samtykke)</li>
          </ul>
          <h3>2.3 Data fra tredjepart</h3>
          <ul className="list-disc pl-6 space-y-1.5 mt-2">
            <li><strong>CVR-register:</strong> Offentlige virksomhedsdata (CVR-nummer, navn, adresse, branche, deltagere). Disse data kan indeholde personoplysninger om enkeltpersoner tilknyttet virksomheder — herunder ejere, direktører, stiftere og tegningsberettigede. Sådanne personoplysninger skal behandles lovligt.</li>
            <li><strong>CRM-systemer:</strong> Kontaktdata synkroniseret via HubSpot, Pipedrive eller LeadConnector (kun med din tilladelse)</li>
            <li><strong>Google OAuth:</strong> Navn og e-mail fra Google-konto ved login via Google (kun hvis du vælger dette)</li>
          </ul>
        </>
      ) : (
        <>
          <h3>2.1 Data you provide</h3>
          <ul className="list-disc pl-6 space-y-1.5 mt-2">
            <li><strong>Account information:</strong> Name, email address and password (hashed) on registration</li>
            <li><strong>Profile information:</strong> Company name, branding settings and language preferences</li>
            <li><strong>Billing information:</strong> Billing address and subscription history (card data is handled exclusively by Stripe)</li>
            <li><strong>User content:</strong> Saved companies, notes, searches, triggers and to-do items</li>
            <li><strong>Communications:</strong> Emails sent to our support team</li>
          </ul>
          <h3>2.2 Data we collect automatically</h3>
          <ul className="list-disc pl-6 space-y-1.5 mt-2">
            <li><strong>Log data:</strong> IP address, browser type, pages visited and timestamps</li>
            <li><strong>Usage patterns:</strong> Which features you use and how often</li>
            <li><strong>Error reports:</strong> Anonymised stack traces via Sentry for debugging</li>
            <li><strong>Performance data:</strong> Page load times via Vercel Speed Insights (consent-gated)</li>
          </ul>
          <h3>2.3 Data from third parties</h3>
          <ul className="list-disc pl-6 space-y-1.5 mt-2">
            <li><strong>CVR register:</strong> Public company data (CVR number, name, address, industry, participants). This data may include personal data about individuals connected to companies — such as owners, directors, founders and authorised signatories. Such personal data must be processed lawfully.</li>
            <li><strong>CRM systems:</strong> Contact data synced via HubSpot, Pipedrive or LeadConnector (only with your permission)</li>
            <li><strong>Google OAuth:</strong> Name and email from your Google account when you choose to sign in with Google</li>
          </ul>
        </>
      ),
  },
  {
    id: "p-3",
    daTitle: "Formål og retsgrundlag",
    enTitle: "Purposes and legal basis",
    content: (l) =>
      l === "da" ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-border mt-2">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Formål</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Retsgrundlag (GDPR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                {[
                  ["Levering af tjenesten og kontostyring", "Art. 6(1)(b) — Kontraktopfyldelse"],
                  ["Fakturering og betalingsbehandling", "Art. 6(1)(b) — Kontraktopfyldelse"],
                  ["Sikkerhed, fejlfinding og misbrug-forebyggelse", "Art. 6(1)(f) — Legitime interesser"],
                  ["Produktforbedring via anonymiserede brugsmønstre", "Art. 6(1)(f) — Legitime interesser"],
                  ["Transaktionelle e-mails (kvitteringer, verifikation)", "Art. 6(1)(b) — Kontraktopfyldelse"],
                  ["AI-funktioner (briefings, outreach-udkast via Google Gemini)", "Art. 6(1)(b) — Kontraktopfyldelse"],
                  ["Markedsføringskommunikation (nyhedsbrev)", "Art. 6(1)(a) — Samtykke"],
                  ["Analytiske cookies og Speed Insights", "Art. 6(1)(a) — Samtykke"],
                  ["Overholdelse af lovkrav", "Art. 6(1)(c) — Retlig forpligtelse"],
                ].map(([f, r]) => (
                  <tr key={f}>
                    <td className="px-4 py-3">{f}</td>
                    <td className="px-4 py-3">{r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border mt-2">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Purpose</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Legal basis (GDPR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                {[
                  ["Providing the service and account management", "Art. 6(1)(b) — Contract performance"],
                  ["Billing and payment processing", "Art. 6(1)(b) — Contract performance"],
                  ["Security, debugging and abuse prevention", "Art. 6(1)(f) — Legitimate interests"],
                  ["Product improvement via anonymised usage patterns", "Art. 6(1)(f) — Legitimate interests"],
                  ["Transactional emails (receipts, verification)", "Art. 6(1)(b) — Contract performance"],
                  ["AI features (briefings, outreach drafts via Google Gemini)", "Art. 6(1)(b) — Contract performance"],
                  ["Marketing communications (newsletter)", "Art. 6(1)(a) — Consent"],
                  ["Analytics cookies and Speed Insights", "Art. 6(1)(a) — Consent"],
                  ["Compliance with legal obligations", "Art. 6(1)(c) — Legal obligation"],
                ].map(([f, r]) => (
                  <tr key={f}>
                    <td className="px-4 py-3">{f}</td>
                    <td className="px-4 py-3">{r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ),
  },
  {
    id: "p-ai",
    daTitle: "AI-funktioner og Google Gemini",
    enTitle: "AI features and Google Gemini",
    content: (l) =>
      l === "da" ? (
        <>
          <p>CVR-MATEs AI-funktioner (virksomhedsbriefings og outreach-udkast) bruger Google Gemini API. Følgende data kan sendes til Google:</p>
          <ul className="list-disc pl-6 space-y-1.5 mt-3">
            <li>Offentlige virksomhedsdata fra CVR (navn, branche, finansielle nøgletal m.v.)</li>
            <li>Brugerinput og kontekst du angiver i forbindelse med generering af indhold</li>
            <li>Noter og beskrivelser fra dit brandprofil (kommunikationstilstand, produktbeskrivelse)</li>
          </ul>
          <p className="mt-3">Følgende sendes <strong>ikke</strong> til Google Gemini: adgangskoder, betalingsdata, sessions-tokens eller andre brugerkontodata.</p>
          <p className="mt-3">Al AI-genereret tekst er et <strong>udkast/forslag</strong>. Teksten udgør ikke juridisk, finansiel eller kommerciel rådgivning og må ikke anvendes ukritisk. Du har ansvar for at gennemlæse og validere ethvert AI-output, inden det sendes eller bruges til beslutningstagning.</p>
          <p className="mt-3">Google behandler data sendt til Gemini API i henhold til Googles <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">privatlivspolitik</a> og Googles Cloud Data Processing Addendum.</p>
        </>
      ) : (
        <>
          <p>CVR-MATE's AI features (company briefings and outreach drafts) use the Google Gemini API. The following data may be sent to Google:</p>
          <ul className="list-disc pl-6 space-y-1.5 mt-3">
            <li>Public company data from the CVR register (name, industry, financial key figures, etc.)</li>
            <li>User input and context provided when generating content</li>
            <li>Notes and descriptions from your brand profile (communication tone, product description)</li>
          </ul>
          <p className="mt-3">The following is <strong>not</strong> sent to Google Gemini: passwords, payment data, session tokens or other user account credentials.</p>
          <p className="mt-3">All AI-generated text is a <strong>draft/suggestion only</strong>. It does not constitute legal, financial or commercial advice and must not be used uncritically. You are responsible for reviewing and validating any AI output before sending it or using it in decision-making.</p>
          <p className="mt-3">Google processes data sent to the Gemini API pursuant to Google's <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and Google's Cloud Data Processing Addendum.</p>
        </>
      ),
  },
  {
    id: "p-4",
    daTitle: "Dataopbevaring",
    enTitle: "Data retention",
    content: (l) =>
      l === "da" ? (
        <>
          <p>Vi opbevarer personoplysninger så længe det er nødvendigt for det pågældende formål:</p>
          <div className="overflow-x-auto rounded-xl border border-border mt-3">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Datakategori</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Opbevaringsperiode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                {[
                  ["Kontodata og brugerindhold", "Aktivt + 30 dage efter kontosletning"],
                  ["Aktivitetslog", "90 dage"],
                  ["E-maillog", "90 dage"],
                  ["Organisations-auditlog", "365 dage"],
                  ["Læste notifikationer", "30 dage"],
                  ["Betalings- og faktureringsdata", "5 år (bogføringsloven)"],
                  ["Session-cookies", "7 dage (fornyes ved aktivitet)"],
                  ["Backuper (Supabase)", "Slettes i overensstemmelse med Supabase' opbevaringspolitik — typisk 7–30 dage efter sletning af primærdata"],
                ].map(([cat, period]) => (
                  <tr key={cat}>
                    <td className="px-4 py-3">{cat}</td>
                    <td className="px-4 py-3">{period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Bemærk: Sletning af primærdata sletter ikke automatisk backupkopier øjeblikkeligt. Backuper overskrives inden for den normale backup-rotationscyklus.</p>
        </>
      ) : (
        <>
          <p>We retain personal data for as long as necessary for the relevant purpose:</p>
          <div className="overflow-x-auto rounded-xl border border-border mt-3">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Data category</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Retention period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                {[
                  ["Account data and user content", "Active + 30 days after account deletion"],
                  ["Activity log", "90 days"],
                  ["Email log", "90 days"],
                  ["Organisation audit log", "365 days"],
                  ["Read notifications", "30 days"],
                  ["Payment and billing data", "5 years (accounting legislation)"],
                  ["Session cookies", "7 days (renewed on activity)"],
                  ["Backups (Supabase)", "Deleted in accordance with Supabase's retention policy — typically 7–30 days after deletion of primary data"],
                ].map(([cat, period]) => (
                  <tr key={cat}>
                    <td className="px-4 py-3">{cat}</td>
                    <td className="px-4 py-3">{period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Note: Deletion of primary data does not immediately delete backup copies. Backups are overwritten within the normal backup rotation cycle.</p>
        </>
      ),
  },
  {
    id: "p-5",
    daTitle: "Deling med tredjeparter",
    enTitle: "Sharing with third parties",
    content: (l) =>
      l === "da" ? (
        <>
          <p>Vi deler kun personoplysninger med de leverandører, der er nødvendige for at levere Tjenesten. Alle databehandlere er underlagt en databehandleraftale:</p>
          <div className="overflow-x-auto rounded-xl border border-border mt-3">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Leverandør</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Formål</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Land</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                {[
                  ["Supabase", "Database og fillagring", "EU (Frankfurt)"],
                  ["Stripe, Inc.", "Betalingsbehandling", "USA (SCCs / DPF)"],
                  ["Resend", "Transaktionelle e-mails", "USA (SCCs)"],
                  ["Google (Gemini API)", "AI-funktioner (briefings, outreach-udkast)", "USA (SCCs)"],
                  ["Sentry, Inc.", "Fejlsporing og ydelses-overvågning", "USA (SCCs)"],
                  ["Vercel, Inc.", "Hosting og CDN", "USA/EU (SCCs)"],
                  ["Upstash", "Redis cache og jobbkø", "EU"],
                ].map(([vendor, purpose, country]) => (
                  <tr key={vendor}>
                    <td className="px-4 py-3 font-medium text-foreground">{vendor}</td>
                    <td className="px-4 py-3">{purpose}</td>
                    <td className="px-4 py-3">{country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs">SCCs = EU's standardkontraktbestemmelser jf. GDPR artikel 46(2)(c). DPF = EU-U.S. Data Privacy Framework, jf. Europa-Kommissionens adequacy-afgørelse af 10. juli 2023. Disse sikrer et passende beskyttelsesniveau ved overførsler til tredjelande.</p>
          <p className="mt-3">Vi sælger aldrig dine personoplysninger til tredjeparter til markedsføringsformål.</p>
        </>
      ) : (
        <>
          <p>We only share personal data with the sub-processors necessary to provide the Service. All processors are bound by a data processing agreement:</p>
          <div className="overflow-x-auto rounded-xl border border-border mt-3">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Vendor</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Purpose</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                {[
                  ["Supabase", "Database and file storage", "EU (Frankfurt)"],
                  ["Stripe, Inc.", "Payment processing", "USA (SCCs / DPF)"],
                  ["Resend", "Transactional emails", "USA (SCCs)"],
                  ["Google (Gemini API)", "AI features (briefings, outreach drafts)", "USA (SCCs)"],
                  ["Sentry, Inc.", "Error tracking and performance monitoring", "USA (SCCs)"],
                  ["Vercel, Inc.", "Hosting and CDN", "USA/EU (SCCs)"],
                  ["Upstash", "Redis cache and job queue", "EU"],
                ].map(([vendor, purpose, country]) => (
                  <tr key={vendor}>
                    <td className="px-4 py-3 font-medium text-foreground">{vendor}</td>
                    <td className="px-4 py-3">{purpose}</td>
                    <td className="px-4 py-3">{country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs">SCCs = EU Standard Contractual Clauses under GDPR Article 46(2)(c). DPF = EU-U.S. Data Privacy Framework pursuant to the European Commission adequacy decision of 10 July 2023. Both mechanisms ensure an adequate level of protection for transfers to third countries.</p>
          <p className="mt-3">We never sell your personal data to third parties for marketing purposes.</p>
        </>
      ),
  },
  {
    id: "p-6",
    daTitle: "Internationale overførsler",
    enTitle: "International transfers",
    content: (l) =>
      l === "da" ? (
        <p>
          Visse underleverandører (Stripe, Google, Sentry, Vercel, Resend) behandler data i USA. Overførsler sker i henhold til EU's standardkontraktbestemmelser (SCCs), jf. GDPR artikel 46(2)(c), og/eller EU-U.S. Data Privacy Framework (DPF), jf. Europa-Kommissionens adequacy-afgørelse af 10. juli 2023. Disse mekanismer sikrer et passende beskyttelsesniveau. Alle overførsler er dokumenteret i vores Register over behandlingsaktiviteter. Du kan anmode om en kopi ved henvendelse til <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      ) : (
        <p>
          Certain sub-processors (Stripe, Google, Sentry, Vercel, Resend) process data in the USA. Transfers are made pursuant to EU Standard Contractual Clauses (SCCs) under GDPR Article 46(2)(c) and/or the EU-U.S. Data Privacy Framework (DPF) pursuant to the European Commission adequacy decision of 10 July 2023. Both mechanisms ensure an adequate level of protection. All transfers are documented in our Record of Processing Activities. You may request a copy by contacting <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      ),
  },
  {
    id: "p-7",
    daTitle: "Cookies og sporing",
    enTitle: "Cookies and tracking",
    content: (l) =>
      l === "da" ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-border mt-2">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Cookie / teknologi</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Formål</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Kræver samtykke</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                {[
                  ["better-auth.session_token", "Autentificerings-session (HttpOnly)", "Nej — strengt nødvendig"],
                  ["cvr-mate-locale", "Sprogpræference (localStorage)", "Nej — funktionel"],
                  ["cvr-cookie-consent", "Gemmer dit samtykkevalg (localStorage)", "Nej — strengt nødvendig"],
                  ["Vercel Analytics", "Anonymiserede sidevisninger", "Ja — analytisk"],
                  ["Vercel Speed Insights", "Sideindlæsningstider", "Ja — analytisk"],
                ].map(([name, purpose, consent]) => (
                  <tr key={name}>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{name}</td>
                    <td className="px-4 py-3">{purpose}</td>
                    <td className="px-4 py-3">{consent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3">Du kan til enhver tid ændre dine cookiepræferencer via cookie-banneret eller under Indstillinger → Privatliv.</p>
        </>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border mt-2">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Cookie / technology</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Purpose</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Requires consent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                {[
                  ["better-auth.session_token", "Authentication session (HttpOnly)", "No — strictly necessary"],
                  ["cvr-mate-locale", "Language preference (localStorage)", "No — functional"],
                  ["cvr-cookie-consent", "Stores your consent choice (localStorage)", "No — strictly necessary"],
                  ["Vercel Analytics", "Anonymised page views", "Yes — analytics"],
                  ["Vercel Speed Insights", "Page load times", "Yes — analytics"],
                ].map(([name, purpose, consent]) => (
                  <tr key={name}>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{name}</td>
                    <td className="px-4 py-3">{purpose}</td>
                    <td className="px-4 py-3">{consent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3">You may update your cookie preferences at any time via the cookie banner or under Settings → Privacy.</p>
        </>
      ),
  },
  {
    id: "p-8",
    daTitle: "Dine rettigheder",
    enTitle: "Your rights",
    content: (l) =>
      l === "da" ? (
        <>
          <p>Som registreret har du følgende rettigheder under GDPR:</p>
          <ul className="list-disc pl-6 space-y-2 mt-3">
            <li><strong>Ret til indsigt (art. 15):</strong> Du kan anmode om en kopi af de personoplysninger, vi behandler om dig.</li>
            <li><strong>Ret til berigtigelse (art. 16):</strong> Du kan anmode om rettelse af urigtige eller ufuldstændige oplysninger.</li>
            <li><strong>Ret til sletning (art. 17):</strong> Du kan anmode om sletning af dine data. Sletning sker via Indstillinger → Konto → Slet konto eller ved henvendelse.</li>
            <li><strong>Ret til begrænsning af behandling (art. 18):</strong> Under visse betingelser kan du anmode om, at behandlingen begrænses.</li>
            <li><strong>Ret til dataportabilitet (art. 20):</strong> Du kan anmode om at modtage dine data i et maskinlæsbart format.</li>
            <li><strong>Ret til indsigelse (art. 21):</strong> Du kan gøre indsigelse mod behandling baseret på legitime interesser.</li>
            <li><strong>Ret til at trække samtykke tilbage:</strong> Samtykke givet til cookies eller markedsføring kan trækkes tilbage til enhver tid.</li>
          </ul>
          <p className="mt-4">
            Send din anmodning til <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Vi besvarer anmodninger inden for 30 dage.
          </p>
          <p className="mt-3">
            Du har også ret til at indgive klage til <strong>Datatilsynet</strong> (Datatilsynet.dk), hvis du mener, vi behandler dine data i strid med GDPR.
          </p>
        </>
      ) : (
        <>
          <p>As a data subject you have the following rights under GDPR:</p>
          <ul className="list-disc pl-6 space-y-2 mt-3">
            <li><strong>Right of access (Art. 15):</strong> You may request a copy of the personal data we hold about you.</li>
            <li><strong>Right to rectification (Art. 16):</strong> You may request correction of inaccurate or incomplete data.</li>
            <li><strong>Right to erasure (Art. 17):</strong> You may request deletion of your data via Settings → Account → Delete account or by contacting us.</li>
            <li><strong>Right to restriction of processing (Art. 18):</strong> Under certain conditions you may request that processing be restricted.</li>
            <li><strong>Right to data portability (Art. 20):</strong> You may request your data in a machine-readable format.</li>
            <li><strong>Right to object (Art. 21):</strong> You may object to processing based on legitimate interests.</li>
            <li><strong>Right to withdraw consent:</strong> Consent given for cookies or marketing may be withdrawn at any time.</li>
          </ul>
          <p className="mt-4">
            Send your request to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We respond to requests within 30 days.
          </p>
          <p className="mt-3">
            You also have the right to lodge a complaint with the <strong>Danish Data Protection Agency</strong> (Datatilsynet.dk) if you believe we are processing your data in breach of GDPR.
          </p>
        </>
      ),
  },
  {
    id: "p-9",
    daTitle: "Sikkerhed",
    enTitle: "Security",
    content: (l) =>
      l === "da" ? (
        <>
          <p>Fourmates ApS anvender følgende tekniske og organisatoriske sikkerhedsforanstaltninger:</p>
          <ul className="list-disc pl-6 space-y-1.5 mt-3">
            <li>HTTPS (TLS 1.2+) for al datatransmission</li>
            <li>Adgangskoder hashes med bcrypt — vi har aldrig adgang til din klartekst-adgangskode</li>
            <li>CRM OAuth-tokens krypteret med AES-256 i databasen</li>
            <li>Session-cookies er HttpOnly og Secure — utilgængelige for JavaScript</li>
            <li>Row Level Security (RLS) på alle databasetabeller</li>
            <li>Fejlovervågning og alerting via Sentry</li>
            <li>Regelmæssige afhængighedsscans (pnpm audit)</li>
          </ul>
          <p className="mt-4">
            Uanset vores sikkerhedsforanstaltninger kan ingen internetbaseret transmission garanteres 100 % sikker. Rapporter sikkerhedssårbarheder ansvarligt til <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </>
      ) : (
        <>
          <p>Fourmates ApS employs the following technical and organisational security measures:</p>
          <ul className="list-disc pl-6 space-y-1.5 mt-3">
            <li>HTTPS (TLS 1.2+) for all data transmission</li>
            <li>Passwords hashed with bcrypt — we never have access to your plaintext password</li>
            <li>CRM OAuth tokens encrypted with AES-256 in the database</li>
            <li>Session cookies are HttpOnly and Secure — inaccessible to JavaScript</li>
            <li>Row Level Security (RLS) on all database tables</li>
            <li>Error monitoring and alerting via Sentry</li>
            <li>Regular dependency scans (pnpm audit)</li>
          </ul>
          <p className="mt-4">
            Despite our security measures, no internet-based transmission can be guaranteed 100% secure. Please report security vulnerabilities responsibly to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </>
      ),
  },
  {
    id: "p-10",
    daTitle: "Børn",
    enTitle: "Children",
    content: (l) =>
      l === "da" ? (
        <p>
          CVR-MATE er udelukkende beregnet til erhvervsmæssig brug af personer på mindst 18 år. Vi indsamler ikke bevidst personoplysninger om børn under 18 år. Opdager vi, at vi utilsigtet har indsamlet sådanne oplysninger, vil vi slette dem omgående.
        </p>
      ) : (
        <p>
          CVR-MATE is exclusively intended for business use by persons aged 18 or older. We do not knowingly collect personal data about children under 18. If we discover that we have inadvertently collected such data, we will delete it promptly.
        </p>
      ),
  },
  {
    id: "p-11",
    daTitle: "Ændringer til privatlivspolitikken",
    enTitle: "Changes to this Privacy Policy",
    content: (l) =>
      l === "da" ? (
        <p>
          Vi kan opdatere denne privatlivspolitik med 30 dages varsel pr. e-mail og via en synlig besked på platformen. Ikrafttrædelsesdatoen øverst på siden angiver, hvornår den seneste version trådte i kraft. Tidligere versioner kan rekvireres ved henvendelse.
        </p>
      ) : (
        <p>
          We may update this Privacy Policy with 30 days' notice via email and a visible notice on the platform. The effective date at the top of the page indicates when the latest version took effect. Previous versions are available on request.
        </p>
      ),
  },
  {
    id: "p-12",
    daTitle: "Kontakt og DPA",
    enTitle: "Contact and DPA",
    content: (l) =>
      l === "da" ? (
        <>
          <p>Spørgsmål om vores behandling af personoplysninger kan rettes til:</p>
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-5 text-sm space-y-1">
            <p className="font-semibold text-foreground">Fourmates ApS — Databeskyttelse</p>
            <p className="text-muted-foreground">CVR-nr. 46256204</p>
            <p className="text-muted-foreground">Vindingvej 34, 7100 Vejle, Danmark</p>
            <p>E-mail: <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium">{CONTACT_EMAIL}</a></p>
            <p className="text-muted-foreground text-xs mt-1">Svartid: normalt inden for 2 hverdage.</p>
          </div>
          <p className="mt-4">
            Ønsker du en <strong>databehandleraftale (DPA)</strong> — f.eks. fordi du bruger CVR-MATE til at behandle dine kontakters personoplysninger via CRM-sync — er den tilgængelig for alle B2B-kunder. Kontakt os på: <a href={`mailto:${DPA_EMAIL}`} className="font-medium">{DPA_EMAIL}</a> med emnet &quot;DPA-anmodning&quot;.
          </p>
        </>
      ) : (
        <>
          <p>Questions about our processing of personal data can be directed to:</p>
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-5 text-sm space-y-1">
            <p className="font-semibold text-foreground">Fourmates ApS — Data Protection</p>
            <p className="text-muted-foreground">CVR no. 46256204</p>
            <p className="text-muted-foreground">Vindingvej 34, 7100 Vejle, Denmark</p>
            <p>Email: <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium">{CONTACT_EMAIL}</a></p>
            <p className="text-muted-foreground text-xs mt-1">Response time: normally within 2 business days.</p>
          </div>
          <p className="mt-4">
            To request a <strong>Data Processing Agreement (DPA)</strong> — for example because you use CVR-MATE to process your contacts' personal data via CRM sync — it is available to all B2B customers. Contact us at: <a href={`mailto:${DPA_EMAIL}`} className="font-medium">{DPA_EMAIL}</a> with the subject &quot;DPA request&quot;.
          </p>
        </>
      ),
  },
];

// ─── Export ───────────────────────────────────────────────────────────────────

export function PrivacyContent() {
  return (
    <LegalPageShell
      page="privacy"
      daTitle="Privatlivspolitik"
      enTitle="Privacy Policy"
      daSubtitle="Denne politik beskriver, hvilke personoplysninger Fourmates ApS indsamler via CVR-MATE platformen, hvordan vi bruger dem, og hvilke rettigheder du har som registreret."
      enSubtitle="This policy describes what personal data Fourmates ApS collects via the CVR-MATE platform, how we use it, and what rights you have as a data subject."
      effectiveDate={EFFECTIVE_DATE}
      sections={sections}
    />
  );
}
