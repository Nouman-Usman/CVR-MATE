"use client";

import Link from "next/link";
import { LegalPageShell, type LegalSection } from "@/components/legal-page-shell";

const EFFECTIVE_DATE = "6. maj 2026 / 6 May 2026";
const CONTACT_EMAIL = "no-reply@cvr-mate.dk";

// ─── Bilingual section content ────────────────────────────────────────────────

const sections: LegalSection[] = [
  {
    id: "section-1",
    daTitle: "Parter og aftalens omfang",
    enTitle: "Parties and scope",
    content: (l) =>
      l === "da" ? (
        <>
          <p>
            Disse vilkår og betingelser (<strong>"Vilkårene"</strong>) regulerer dit brug af CVR-MATE platformen (<strong>"Tjenesten"</strong>), der drives af CVR-MATE (<strong>"vi"</strong>, <strong>"os"</strong>), med hjemsted i Danmark.
          </p>
          <p>
            <strong>"Du"</strong> eller <strong>"Brugeren"</strong> refererer til den fysiske person eller juridiske enhed, der opretter en konto og bruger Tjenesten. Opretter du en konto på vegne af en virksomhed, indestår du for at have den nødvendige fuldmagt til at binde denne virksomhed.
          </p>
          <p>
            Ved at klikke "Opret konto" eller tilgå Tjenesten bekræfter du, at du har læst, forstået og accepterer disse Vilkår.
          </p>
        </>
      ) : (
        <>
          <p>
            These Terms and Conditions (<strong>"Terms"</strong>) govern your use of the CVR-MATE platform (<strong>"Service"</strong>), operated by CVR-MATE (<strong>"we"</strong>, <strong>"us"</strong>), headquartered in Denmark.
          </p>
          <p>
            <strong>"You"</strong> or <strong>"User"</strong> refers to the individual or legal entity that creates an account and uses the Service. If you create an account on behalf of a company, you warrant that you have the authority to bind that company to these Terms.
          </p>
          <p>
            By clicking "Create account" or accessing the Service, you confirm that you have read, understood and accept these Terms.
          </p>
        </>
      ),
  },
  {
    id: "section-2",
    daTitle: "Beskrivelse af tjenesten",
    enTitle: "Description of the Service",
    content: (l) =>
      l === "da" ? (
        <>
          <p>
            CVR-MATE er en B2B lead intelligence platform målrettet det danske marked. Tjenesten giver adgang til virksomhedsdata fra Det Centrale Virksomhedsregister (CVR) suppleret med:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 mt-3">
            <li>Søgning og filtrering af danske virksomheder baseret på branche, størrelse og geografi</li>
            <li>AI-genererede virksomhedsbriefings og outreach-udkast (Google Gemini)</li>
            <li>Overvågning af virksomhedsændringer via automatiske triggers og notifikationer</li>
            <li>CRM-integrationer (HubSpot, Pipedrive, LeadConnector)</li>
            <li>Team-funktionalitet med rollebaseret adgangsstyring for Enterprise-kunder</li>
            <li>Eksport af data til salgs- og marketingformål</li>
            <li>Personovervågning for virksomhedsdeltagere og direktører</li>
          </ul>
          <p className="mt-4">
            Tilgængelighed og funktionalitet afhænger af dit abonnement. CVR-MATE forbeholder sig ret til at ændre funktioner med rimeligt varsel.
          </p>
        </>
      ) : (
        <>
          <p>
            CVR-MATE is a B2B lead intelligence platform targeting the Danish market. The Service provides access to company data from the Danish Central Business Register (CVR), supplemented by:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 mt-3">
            <li>Search and filtering of Danish companies by industry, size and geography</li>
            <li>AI-generated company briefings and outreach drafts (Google Gemini)</li>
            <li>Monitoring of company changes via automated triggers and notifications</li>
            <li>CRM integrations (HubSpot, Pipedrive, LeadConnector)</li>
            <li>Team features with role-based access control for Enterprise customers</li>
            <li>Data export for sales and marketing purposes</li>
            <li>Person monitoring for company participants and directors</li>
          </ul>
          <p className="mt-4">
            Availability and functionality depend on your subscription plan. CVR-MATE reserves the right to modify features with reasonable notice.
          </p>
        </>
      ),
  },
  {
    id: "section-3",
    daTitle: "Kontooprettelse og adgang",
    enTitle: "Account creation and access",
    content: (l) =>
      l === "da" ? (
        <>
          <h3>3.1 Registrering</h3>
          <p>Du skal oprette en konto med en gyldig e-mailadresse og bekræfte denne via vores verifikationsmail. Du er ansvarlig for nøjagtigheden af dine oplysninger.</p>
          <h3>3.2 Kontosikkerhed</h3>
          <p>Du er eneansvarlig for at beskytte dine loginoplysninger og for al aktivitet under din konto. Del ikke dine loginoplysninger med andre. Kontakt os straks ved mistanke om uautoriseret adgang: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
          <h3>3.3 Minimumsalder</h3>
          <p>Du skal være mindst 18 år og bruge Tjenesten til erhvervsmæssige formål.</p>
          <h3>3.4 Én konto pr. bruger</h3>
          <p>Hver bruger må kun have én aktiv konto, medmindre CVR-MATE udtrykkeligt har givet tilladelse til andet.</p>
        </>
      ) : (
        <>
          <h3>3.1 Registration</h3>
          <p>You must create an account with a valid email address and confirm it via our verification email. You are responsible for the accuracy of the information you provide.</p>
          <h3>3.2 Account security</h3>
          <p>You are solely responsible for safeguarding your login credentials and all activity under your account. Do not share credentials with others. Contact us immediately if you suspect unauthorised access: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
          <h3>3.3 Minimum age</h3>
          <p>You must be at least 18 years old and use the Service for business purposes only.</p>
          <h3>3.4 One account per user</h3>
          <p>Each user may only have one active account unless CVR-MATE has explicitly granted permission otherwise.</p>
        </>
      ),
  },
  {
    id: "section-4",
    daTitle: "Abonnementer og betaling",
    enTitle: "Subscriptions and payment",
    content: (l) =>
      l === "da" ? (
        <>
          <h3>4.1 Abonnementsplaner</h3>
          <div className="overflow-x-auto rounded-xl border border-border mt-2">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Plan</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Månedlig</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Årlig (pr. md.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[["Free","0 DKK","0 DKK"],["Starter","299 DKK","239 DKK"],["Professional","699 DKK","559 DKK"],["Enterprise","1.699 DKK","1.359 DKK"]].map(([plan,mo,yr])=>(
                  <tr key={plan}><td className="px-4 py-3 font-medium text-foreground">{plan}</td><td className="px-4 py-3 text-muted-foreground">{mo}</td><td className="px-4 py-3 text-muted-foreground">{yr}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2">Alle priser er ekskl. moms (25 % tillægges ved betaling).</p>
          <h3>4.2 Fakturering og fornyelse</h3>
          <p>Betalte abonnementer faktureres forud og fornyes automatisk. Betalinger behandles via Stripe.</p>
          <h3>4.3 Prisændringer</h3>
          <p>Prisændringer varsles minimum 30 dage i forvejen pr. e-mail. Fortsat brug efter ikrafttrædelse udgør accept.</p>
          <h3>4.4 Refusion</h3>
          <p>Der ydes som udgangspunkt ikke refusion. Forbrugere i EU har 14 dages fortrydelsesret jf. forbrugeraftaleloven § 18, medmindre tjenesten er fuldt taget i brug. Utilsigtet fornyelse kan refunderes inden for 7 dage ved henvendelse.</p>
          <h3>4.5 Manglende betaling</h3>
          <p>Ved manglende betaling nedgraderes kontoen til Free-planen efter 3 dages frist. Data bevares i 30 dage herefter.</p>
        </>
      ) : (
        <>
          <h3>4.1 Subscription plans</h3>
          <div className="overflow-x-auto rounded-xl border border-border mt-2">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Plan</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Monthly</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Annual (per mo.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[["Free","DKK 0","DKK 0"],["Starter","DKK 299","DKK 239"],["Professional","DKK 699","DKK 559"],["Enterprise","DKK 1,699","DKK 1,359"]].map(([plan,mo,yr])=>(
                  <tr key={plan}><td className="px-4 py-3 font-medium text-foreground">{plan}</td><td className="px-4 py-3 text-muted-foreground">{mo}</td><td className="px-4 py-3 text-muted-foreground">{yr}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2">All prices exclude VAT (25% applied at checkout).</p>
          <h3>4.2 Billing and renewal</h3>
          <p>Paid subscriptions are billed in advance and renew automatically. Payments are processed by Stripe.</p>
          <h3>4.3 Price changes</h3>
          <p>Price changes are communicated at least 30 days in advance by email. Continued use after the effective date constitutes acceptance.</p>
          <h3>4.4 Refunds</h3>
          <p>Refunds are not generally provided for completed billing periods. EU consumers have a 14-day withdrawal right under applicable consumer law, unless the service has been fully used. Accidental renewals may be refunded within 7 days on request.</p>
          <h3>4.5 Failed payment</h3>
          <p>If payment fails, the account is downgraded to the Free plan after a 3-day grace period. Data is retained for 30 days thereafter.</p>
        </>
      ),
  },
  {
    id: "section-5",
    daTitle: "Acceptabel brug",
    enTitle: "Acceptable use",
    content: (l) =>
      l === "da" ? (
        <>
          <p>Du må kun bruge Tjenesten til lovlige erhvervsmæssige formål i overensstemmelse med gældende dansk og EU-ret.</p>
          <p className="mt-2 font-semibold text-foreground">Du må ikke:</p>
          <ul className="list-disc pl-6 space-y-1.5 mt-2">
            <li>Videresælge eller sublicensere adgang til Tjenesten til tredjeparter uden skriftlig tilladelse</li>
            <li>Scrape eller massedownloade data ud over API-kvoterne</li>
            <li>Omgå rate limits, adgangsbegrænsninger eller sikkerhedsforanstaltninger</li>
            <li>Bruge data til spam eller uopfordret markedsføring i strid med markedsføringsloven eller GDPR</li>
            <li>Anvende AI-genererede indsigter til vildledning eller svindel</li>
            <li>Forsøge at identificere eller kontakte personer på en chikanerende måde</li>
            <li>Foretage reverse engineering af platformen</li>
            <li>Uploade malware eller skadeligt indhold</li>
            <li>Oprette falske konti eller misbruge gratisfunktioner</li>
          </ul>
          <p className="mt-4">Overtrædelse kan medføre øjeblikkelig kontosuspendering uden refusion.</p>
        </>
      ) : (
        <>
          <p>You may only use the Service for lawful business purposes in accordance with applicable Danish and EU law.</p>
          <p className="mt-2 font-semibold text-foreground">You must not:</p>
          <ul className="list-disc pl-6 space-y-1.5 mt-2">
            <li>Resell or sublicense access to the Service without written permission</li>
            <li>Scrape or bulk-download data beyond API quotas</li>
            <li>Circumvent rate limits, access restrictions or security measures</li>
            <li>Use data for spam or unsolicited marketing in violation of applicable law or GDPR</li>
            <li>Use AI-generated insights for deception or fraud</li>
            <li>Attempt to identify or contact individuals in a harassing manner</li>
            <li>Reverse-engineer the platform</li>
            <li>Upload malware or harmful content</li>
            <li>Create fake accounts or abuse free-tier features</li>
          </ul>
          <p className="mt-4">Violations may result in immediate account suspension without refund.</p>
        </>
      ),
  },
  {
    id: "section-6",
    daTitle: "Datakilder og ansvar for indhold",
    enTitle: "Data sources and content liability",
    content: (l) =>
      l === "da" ? (
        <>
          <h3>6.1 CVR-data</h3>
          <p>CVR-MATE henter virksomhedsdata fra Det Centrale Virksomhedsregister via cvrapi.dk. Disse data er offentligt tilgængelige. CVR-MATE er ikke ansvarlig for fejl, udeladelser eller forsinkelser, der stammer fra registret.</p>
          <h3>6.2 AI-genereret indhold</h3>
          <p>Tekster genereret af AI-funktionerne er vejledende og udgør ikke juridisk, finansiel eller kommerciel rådgivning. Du bærer fuldt ansvar for at validere AI-output, inden det anvendes.</p>
          <h3>6.3 Tredjepartsdata</h3>
          <p>CVR-MATE påtager sig intet ansvar for datatilgængelighed, nøjagtighed eller brug hos tredjeparter (HubSpot, Pipedrive, LeadConnector, Stripe m.fl.).</p>
        </>
      ) : (
        <>
          <h3>6.1 CVR data</h3>
          <p>CVR-MATE fetches company data from the Danish Central Business Register via cvrapi.dk. This data is publicly available. CVR-MATE is not responsible for errors, omissions or delays originating from the register.</p>
          <h3>6.2 AI-generated content</h3>
          <p>Text generated by AI features is indicative only and does not constitute legal, financial or commercial advice. You bear full responsibility for validating AI output before use.</p>
          <h3>6.3 Third-party data</h3>
          <p>CVR-MATE accepts no responsibility for data availability, accuracy or use by third parties (HubSpot, Pipedrive, LeadConnector, Stripe, etc.).</p>
        </>
      ),
  },
  {
    id: "section-7",
    daTitle: "Intellektuel ejendomsret",
    enTitle: "Intellectual property",
    content: (l) =>
      l === "da" ? (
        <>
          <h3>7.1 CVR-MATEs rettigheder</h3>
          <p>CVR-MATE og dets licensgivere ejer alle rettigheder til platformen, herunder software, design, databaser og varemærker. Du modtager en begrænset, ikke-eksklusiv licens til at bruge Tjenesten inden for dit abonnements rammer.</p>
          <h3>7.2 Brugerindhold</h3>
          <p>Indhold du uploader (noter, søgninger, tags) forbliver dit. Du giver CVR-MATE en begrænset licens til at behandle det med henblik på levering af Tjenesten.</p>
          <h3>7.3 Feedback</h3>
          <p>Feedback og forslag du sender til CVR-MATE kan bruges frit til produktforbedringer uden kompensation.</p>
        </>
      ) : (
        <>
          <h3>7.1 CVR-MATE rights</h3>
          <p>CVR-MATE and its licensors own all rights to the platform, including software, design, databases and trademarks. You receive a limited, non-exclusive licence to use the Service within the bounds of your subscription.</p>
          <h3>7.2 User content</h3>
          <p>Content you upload (notes, searches, tags) remains yours. You grant CVR-MATE a limited licence to process it solely for the purpose of providing the Service.</p>
          <h3>7.3 Feedback</h3>
          <p>Feedback and suggestions you send to CVR-MATE may be freely used for product improvements without compensation.</p>
        </>
      ),
  },
  {
    id: "section-8",
    daTitle: "Databeskyttelse og GDPR",
    enTitle: "Data protection and GDPR",
    content: (l) =>
      l === "da" ? (
        <>
          <h3>8.1 Databehandling</h3>
          <p>CVR-MATE behandler personoplysninger i overensstemmelse med GDPR og den danske databeskyttelseslov. Se vores <Link href="/privacy">Privatlivspolitik</Link> for detaljer.</p>
          <h3>8.2 Ret til sletning</h3>
          <p>Du kan anmode om sletning af din konto og alle tilknyttede data via Indstillinger → Konto → Slet konto. Sletning er permanent og behandles inden for 30 dage jf. GDPR artikel 17.</p>
          <h3>8.3 Cookies</h3>
          <p>Session-cookies bruges til autentificering og kræver ikke samtykke. Analytiske cookies (Vercel Analytics) aktiveres kun med eksplicit samtykke via cookie-banneret.</p>
          <h3>8.4 Dataopbevaring</h3>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Aktivitetslog og e-maillog: 90 dage</li>
            <li>Organisations-auditlog: 365 dage</li>
            <li>Læste notifikationer: 30 dage</li>
            <li>Kontodata: Aktivt + 30 dage efter sletning</li>
          </ul>
          <h3>8.5 Databehandleraftale</h3>
          <p>I det omfang du behandler personoplysninger om dine kontakter via CVR-MATE (f.eks. CRM-sync), optræder CVR-MATE som databehandler. En databehandleraftale (DPA) kan rekvireres via <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </>
      ) : (
        <>
          <h3>8.1 Data processing</h3>
          <p>CVR-MATE processes personal data in accordance with GDPR and Danish data protection law. See our <Link href="/privacy">Privacy Policy</Link> for details.</p>
          <h3>8.2 Right to erasure</h3>
          <p>You may request deletion of your account and all associated data via Settings → Account → Delete account. Deletion is permanent and processed within 30 days per GDPR Article 17.</p>
          <h3>8.3 Cookies</h3>
          <p>Session cookies are used for authentication and do not require consent. Analytics cookies (Vercel Analytics) are only activated with your explicit consent via the cookie banner.</p>
          <h3>8.4 Data retention</h3>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Activity log and email log: 90 days</li>
            <li>Organisation audit log: 365 days</li>
            <li>Read notifications: 30 days</li>
            <li>Account data: Active + 30 days after deletion</li>
          </ul>
          <h3>8.5 Data processing agreement</h3>
          <p>Where you process personal data about your contacts via CVR-MATE (e.g. CRM sync), CVR-MATE acts as data processor. A Data Processing Agreement (DPA) can be requested at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </>
      ),
  },
  {
    id: "section-9",
    daTitle: "Tredjepartsintegrationer",
    enTitle: "Third-party integrations",
    content: (l) =>
      l === "da" ? (
        <>
          <p>Tjenesten muliggør integration med HubSpot, Pipedrive og LeadConnector. Disse er underlagt de respektive parters vilkår. CVR-MATE påtager sig intet ansvar for tredjeparters handlinger eller fejl.</p>
          <p className="mt-3">OAuth-adgangstokens til CRM-integrationer opbevares krypteret. Du kan frakoble en integration via Indstillinger → Integrationer.</p>
          <p className="mt-3">Betalinger behandles udelukkende af Stripe, Inc. CVR-MATE gemmer aldrig betalingskortoplysninger direkte.</p>
        </>
      ) : (
        <>
          <p>The Service enables integrations with HubSpot, Pipedrive and LeadConnector. These are subject to the respective parties' own terms. CVR-MATE accepts no responsibility for third-party actions or failures.</p>
          <p className="mt-3">OAuth access tokens for CRM integrations are stored encrypted. You can disconnect an integration via Settings → Integrations.</p>
          <p className="mt-3">Payments are processed exclusively by Stripe, Inc. CVR-MATE never stores payment card details directly.</p>
        </>
      ),
  },
  {
    id: "section-10",
    daTitle: "Ansvarsbegrænsning",
    enTitle: "Limitation of liability",
    content: (l) =>
      l === "da" ? (
        <>
          <h3>10.1 Tilgængelighed</h3>
          <p>CVR-MATE tilstræber 99,5 % oppetid pr. kalendermåned, men garanterer ingen bestemt tilgængelighed.</p>
          <h3>10.2 Ansvarsloft</h3>
          <p>CVR-MATEs samlede ansvar er begrænset til det beløb, du har betalt de seneste 3 måneder, dog maksimalt 5.000 DKK. CVR-MATE er ikke ansvarlig for indirekte tab, tabt omsætning eller følgeskader.</p>
          <h3>10.3 Force majeure</h3>
          <p>CVR-MATE er ikke ansvarlig ved nedbrud hos tredjeparts-API'er (CVR, Google, Stripe), naturkatastrofer, cyberangreb eller andre forhold uden for vores kontrol.</p>
        </>
      ) : (
        <>
          <h3>10.1 Availability</h3>
          <p>CVR-MATE targets 99.5% uptime per calendar month but does not guarantee any specific availability.</p>
          <h3>10.2 Liability cap</h3>
          <p>CVR-MATE's total liability is limited to the amount you have paid in the preceding 3 months, with a maximum of DKK 5,000. CVR-MATE is not liable for indirect loss, lost revenue or consequential damages.</p>
          <h3>10.3 Force majeure</h3>
          <p>CVR-MATE is not liable for failures of third-party APIs (CVR, Google, Stripe), natural disasters, cyberattacks or other events outside our control.</p>
        </>
      ),
  },
  {
    id: "section-11",
    daTitle: "Opsigelse",
    enTitle: "Termination",
    content: (l) =>
      l === "da" ? (
        <>
          <h3>11.1 Opsigelse af dig</h3>
          <p>Du kan opsige dit abonnement til enhver tid via Indstillinger → Abonnement. Opsigelse træder i kraft ved udgangen af den igangværende betalingsperiode.</p>
          <h3>11.2 Opsigelse af CVR-MATE</h3>
          <p>CVR-MATE kan opsige kontoen med øjeblikkelig virkning ved væsentlig overtrædelse af afsnit 5. For øvrige opsigelser gælder 30 dages varsel. Ved lukning af tjenesten som helhed: minimum 60 dages varsel og forholdsmæssig refusion.</p>
          <h3>11.3 Effekt af opsigelse</h3>
          <p>Adgang ophæves. Data opbevares i 30 dage, inden de slettes permanent.</p>
        </>
      ) : (
        <>
          <h3>11.1 Termination by you</h3>
          <p>You may cancel your subscription at any time via Settings → Subscription. Cancellation takes effect at the end of the current billing period.</p>
          <h3>11.2 Termination by CVR-MATE</h3>
          <p>CVR-MATE may terminate your account with immediate effect for material breach of Section 5. For other terminations, 30 days' notice applies. If the Service is discontinued entirely: minimum 60 days' notice and pro-rata refund.</p>
          <h3>11.3 Effect of termination</h3>
          <p>Access is revoked. Data is retained for 30 days before permanent deletion.</p>
        </>
      ),
  },
  {
    id: "section-12",
    daTitle: "Ændringer af vilkår",
    enTitle: "Changes to these Terms",
    content: (l) =>
      l === "da" ? (
        <p>CVR-MATE kan ændre disse Vilkår med 30 dages varsel via e-mail og en synlig besked på platformen. Fortsætter du med at bruge Tjenesten efter ikrafttrædelse, accepterer du de ændrede Vilkår. Tidligere versioner kan rekvireres ved henvendelse.</p>
      ) : (
        <p>CVR-MATE may amend these Terms with 30 days' notice via email and a visible notice on the platform. Continued use after the effective date constitutes acceptance. Previous versions are available on request.</p>
      ),
  },
  {
    id: "section-13",
    daTitle: "Gældende lov og værneting",
    enTitle: "Governing law and jurisdiction",
    content: (l) =>
      l === "da" ? (
        <>
          <p>Disse Vilkår er underlagt dansk ret. Tvister søges løst ved forhandling; i modsat fald ved de ordinære danske domstole med retten i CVR-MATEs hjemstedskommune som værneting.</p>
          <p className="mt-3">Forbrugere i EU kan klage til EU-Kommissionens ODR-platform: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>.</p>
        </>
      ) : (
        <>
          <p>These Terms are governed by Danish law. Disputes shall be resolved by negotiation where possible; otherwise by the ordinary Danish courts in CVR-MATE's home municipality.</p>
          <p className="mt-3">EU consumers may also submit complaints to the European Commission's ODR platform: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>.</p>
        </>
      ),
  },
  {
    id: "section-14",
    daTitle: "Kontakt",
    enTitle: "Contact",
    content: (l) => (
      <>
        <p className={l === "da" ? "" : ""}>
          {l === "da"
            ? "Har du spørgsmål til disse Vilkår, kan du kontakte os:"
            : "If you have questions about these Terms, please contact us:"}
        </p>
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-5 space-y-1 text-sm">
          <p className="font-semibold text-foreground">CVR-MATE</p>
          <p className="text-muted-foreground">Danmark</p>
          <p>
            {l === "da" ? "E-mail: " : "Email: "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium">{CONTACT_EMAIL}</a>
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            {l === "da" ? "Svartid: normalt inden for 2 hverdage." : "Response time: normally within 2 business days."}
          </p>
        </div>
      </>
    ),
  },
];

// ─── Export ───────────────────────────────────────────────────────────────────

export function TermsContent() {
  return (
    <LegalPageShell
      page="terms"
      daTitle="Vilkår & Betingelser"
      enTitle="Terms & Conditions"
      daSubtitle="Læs disse vilkår grundigt, inden du bruger CVR-MATE. Ved at oprette en konto eller tilgå platformen accepterer du disse vilkår i sin helhed."
      enSubtitle="Please read these Terms carefully before using CVR-MATE. By creating an account or accessing the platform you accept these Terms in full."
      effectiveDate={EFFECTIVE_DATE}
      sections={sections}
    />
  );
}
