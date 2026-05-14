"use client";

import { LegalPageShell, type LegalSection } from "@/components/legal-page-shell";

const EFFECTIVE_DATE = "15. maj 2026 / 15 May 2026";
const CONTACT_EMAIL = "dev@fourmates.dk";

const sections: LegalSection[] = [
  {
    id: "ds-1",
    daTitle: "Oversigt",
    enTitle: "Overview",
    content: (l) =>
      l === "da" ? (
        <p>
          CVR-MATE behandler forretningskritiske data på vegne af vores kunder. Vi har implementeret
          tekniske og organisatoriske sikkerhedsforanstaltninger i overensstemmelse med GDPR og
          industriens bedste praksis for at beskytte disse data mod uautoriseret adgang, tab og
          misbrug.
        </p>
      ) : (
        <p>
          CVR-MATE processes business-critical data on behalf of our customers. We have implemented
          technical and organizational security measures in accordance with GDPR and industry best
          practices to protect this data against unauthorized access, loss, and misuse.
        </p>
      ),
  },
  {
    id: "ds-2",
    daTitle: "Infrastruktur og hosting",
    enTitle: "Infrastructure & hosting",
    content: (l) =>
      l === "da" ? (
        <>
          <p>Vores platform kører på enterprise-grade cloud-infrastruktur med følgende garantier:</p>
          <ul className="list-disc pl-6 space-y-1.5 mt-3">
            <li><strong>Cloudhosting:</strong> Vercel (Edge Network) til applikationslaget med global CDN og DDoS-beskyttelse</li>
            <li><strong>Database:</strong> Supabase (PostgreSQL) med automatisk backup, point-in-time recovery og krypteret opbevaring</li>
            <li><strong>Datacenter:</strong> EU-baseret (Frankfurt, eu-west-1) — alle data forbliver inden for EU</li>
            <li><strong>Oppetid:</strong> 99,9 % SLA-garanti med redundante systemer</li>
          </ul>
        </>
      ) : (
        <>
          <p>Our platform runs on enterprise-grade cloud infrastructure with the following guarantees:</p>
          <ul className="list-disc pl-6 space-y-1.5 mt-3">
            <li><strong>Cloud hosting:</strong> Vercel (Edge Network) for the application layer with global CDN and DDoS protection</li>
            <li><strong>Database:</strong> Supabase (PostgreSQL) with automatic backups, point-in-time recovery, and encrypted storage</li>
            <li><strong>Data center:</strong> EU-based (Frankfurt, eu-west-1) — all data stays within the EU</li>
            <li><strong>Uptime:</strong> 99.9% SLA guarantee with redundant systems</li>
          </ul>
        </>
      ),
  },
  {
    id: "ds-3",
    daTitle: "Kryptering",
    enTitle: "Encryption",
    content: (l) =>
      l === "da" ? (
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Under transport:</strong> TLS 1.2+ på alle forbindelser — ingen ukrypteret HTTP</li>
          <li><strong>I ro:</strong> AES-256 kryptering af databaseindhold og sikkerhedskopier</li>
          <li><strong>Adgangskoder:</strong> bcrypt-hashing via Better Auth — vi gemmer aldrig adgangskoder i klartekst</li>
          <li><strong>CRM-tokens:</strong> OAuth-adgangstokens krypteres med AES-256 med en dedikeret nøgle (<code>CRM_TOKEN_ENCRYPTION_KEY</code>) inden de gemmes i databasen</li>
          <li><strong>Betalingsdata:</strong> Kortdata håndteres udelukkende af Stripe (PCI DSS Level 1) — CVR-MATE gemmer aldrig rå kortoplysninger</li>
        </ul>
      ) : (
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>In transit:</strong> TLS 1.2+ on all connections — no unencrypted HTTP</li>
          <li><strong>At rest:</strong> AES-256 encryption of database contents and backups</li>
          <li><strong>Passwords:</strong> bcrypt hashing via Better Auth — we never store passwords in plaintext</li>
          <li><strong>CRM tokens:</strong> OAuth access tokens are encrypted with AES-256 using a dedicated key (<code>CRM_TOKEN_ENCRYPTION_KEY</code>) before being stored in the database</li>
          <li><strong>Payment data:</strong> Card data is handled exclusively by Stripe (PCI DSS Level 1) — CVR-MATE never stores raw card details</li>
        </ul>
      ),
  },
  {
    id: "ds-4",
    daTitle: "Adgangskontrol og autentifikation",
    enTitle: "Access control & authentication",
    content: (l) =>
      l === "da" ? (
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Sessions:</strong> 7-dages sessioner med krypterede HTTP-only cookies og sessionscache på 5 minutter</li>
          <li><strong>E-mailbekræftelse:</strong> Påkrævet for alle nye konti — ubekræftede e-mails kan ikke logge ind</li>
          <li><strong>Google OAuth:</strong> Understøttet som alternativ til adgangskode-login</li>
          <li><strong>Rollebaseret adgang (RBAC):</strong> Tre niveauer — ejer, administrator, medlem — med rangbaserede tilladelsestjek</li>
          <li><strong>Row Level Security (RLS):</strong> Aktiveret på alle databasetabeller i Supabase — PostgREST-API blokerer al direkte tabeladgang</li>
          <li><strong>Intern adgang:</strong> Produktionsadgang til databaser er begrænset til autoriserede udviklere med revisionsspor</li>
        </ul>
      ) : (
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Sessions:</strong> 7-day sessions with encrypted HTTP-only cookies and a 5-minute session cache</li>
          <li><strong>Email verification:</strong> Required for all new accounts — unverified emails cannot log in</li>
          <li><strong>Google OAuth:</strong> Supported as an alternative to password login</li>
          <li><strong>Role-based access (RBAC):</strong> Three levels — owner, admin, member — with rank-based permission checks</li>
          <li><strong>Row Level Security (RLS):</strong> Enabled on all database tables in Supabase — PostgREST API blocks all direct table access</li>
          <li><strong>Internal access:</strong> Production database access is restricted to authorized developers with an audit trail</li>
        </ul>
      ),
  },
  {
    id: "ds-5",
    daTitle: "Overvågning og hændelsesberedskab",
    enTitle: "Monitoring & incident response",
    content: (l) =>
      l === "da" ? (
        <>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Fejlsporing:</strong> Sentry bruges til realtidsovervågning af fejl og performance med anonymiserede stack traces</li>
            <li><strong>Betalingsovervågning:</strong> Stripe Radar registrerer mistænkelig betalingsaktivitet automatisk</li>
            <li><strong>Adgangslog:</strong> Organisatoriske handlinger logges i revisionssporet (<code>org_audit_log</code>)</li>
          </ul>
          <p className="mt-4">
            Ved sikkerhedshændelser kontakter vi berørte brugere inden for 72 timer i overensstemmelse med GDPR artikel 33–34.
            Kontakt os øjeblikkeligt på{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium underline underline-offset-2">{CONTACT_EMAIL}</a>{" "}
            hvis du opdager en mulig sårbarhed.
          </p>
        </>
      ) : (
        <>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Error tracking:</strong> Sentry is used for real-time error and performance monitoring with anonymized stack traces</li>
            <li><strong>Payment monitoring:</strong> Stripe Radar automatically detects suspicious payment activity</li>
            <li><strong>Access logging:</strong> Organizational actions are logged in the audit trail (<code>org_audit_log</code>)</li>
          </ul>
          <p className="mt-4">
            In the event of a security incident, we will notify affected users within 72 hours in accordance with GDPR Articles 33–34.
            Contact us immediately at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium underline underline-offset-2">{CONTACT_EMAIL}</a>{" "}
            if you discover a potential vulnerability.
          </p>
        </>
      ),
  },
  {
    id: "ds-6",
    daTitle: "Tredjepartstjenester",
    enTitle: "Third-party services",
    content: (l) =>
      l === "da" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-semibold text-foreground">Tjeneste</th>
                <th className="text-left py-2 pr-4 font-semibold text-foreground">Formål</th>
                <th className="text-left py-2 font-semibold text-foreground">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr><td className="py-2 pr-4 font-medium text-foreground">Supabase</td><td className="py-2 pr-4">Database</td><td className="py-2">Alle brugerdata (EU)</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-foreground">Vercel</td><td className="py-2 pr-4">Hosting</td><td className="py-2">Request-logs</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-foreground">Stripe</td><td className="py-2 pr-4">Betalinger</td><td className="py-2">Fakturering, kortdata</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-foreground">Resend</td><td className="py-2 pr-4">Email</td><td className="py-2">E-mailadresse, indhold</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-foreground">Sentry</td><td className="py-2 pr-4">Fejlsporing</td><td className="py-2">Anonymiserede fejllogs</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-foreground">Google Gemini</td><td className="py-2 pr-4">AI</td><td className="py-2">Virksomhedsdata til briefings</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-foreground">Upstash</td><td className="py-2 pr-4">Cache / køer</td><td className="py-2">Midlertidige session-data</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-semibold text-foreground">Service</th>
                <th className="text-left py-2 pr-4 font-semibold text-foreground">Purpose</th>
                <th className="text-left py-2 font-semibold text-foreground">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr><td className="py-2 pr-4 font-medium text-foreground">Supabase</td><td className="py-2 pr-4">Database</td><td className="py-2">All user data (EU)</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-foreground">Vercel</td><td className="py-2 pr-4">Hosting</td><td className="py-2">Request logs</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-foreground">Stripe</td><td className="py-2 pr-4">Payments</td><td className="py-2">Billing, card data</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-foreground">Resend</td><td className="py-2 pr-4">Email</td><td className="py-2">Email address, content</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-foreground">Sentry</td><td className="py-2 pr-4">Error tracking</td><td className="py-2">Anonymized error logs</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-foreground">Google Gemini</td><td className="py-2 pr-4">AI</td><td className="py-2">Company data for briefings</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-foreground">Upstash</td><td className="py-2 pr-4">Cache / queues</td><td className="py-2">Temporary session data</td></tr>
            </tbody>
          </table>
        </div>
      ),
  },
  {
    id: "ds-7",
    daTitle: "Sletning af data og ret til sletning",
    enTitle: "Data deletion & right to erasure",
    content: (l) =>
      l === "da" ? (
        <p>
          Brugere kan slette deres konto til enhver tid fra Indstillinger → Farezone. Sletning fjerner alle
          personoplysninger permanent via <code>ON DELETE CASCADE</code>-regler på alle tabeller.
          Aktive Stripe-abonnementer annulleres øjeblikkeligt ved sletning. Revisionslogposter (<code>org_audit_log</code>)
          anonymiseres — aktørnavnet fjernes, men handlingen bevares til compliance. Se vores{" "}
          <a href="/privacy" className="font-medium underline underline-offset-2">privatlivspolitik</a>{" "}
          for yderligere oplysninger om dine rettigheder i henhold til GDPR.
        </p>
      ) : (
        <p>
          Users can delete their account at any time from Settings → Danger Zone. Deletion permanently removes
          all personal data via <code>ON DELETE CASCADE</code> rules across all tables. Active Stripe
          subscriptions are cancelled immediately upon deletion. Audit log entries (<code>org_audit_log</code>)
          are anonymized — the actor name is removed but the action is retained for compliance. See our{" "}
          <a href="/privacy" className="font-medium underline underline-offset-2">privacy policy</a>{" "}
          for further details on your rights under GDPR.
        </p>
      ),
  },
  {
    id: "ds-8",
    daTitle: "Kontakt og ansvarlig oplysning",
    enTitle: "Contact & responsible disclosure",
    content: (l) =>
      l === "da" ? (
        <>
          <p>
            Har du fundet en sikkerhedssårbarhed? Vi opfordrer til ansvarlig offentliggørelse. Send en
            detaljeret rapport til{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium underline underline-offset-2">{CONTACT_EMAIL}</a>{" "}
            med emnet &quot;Security Report&quot;. Vi bekræfter modtagelse inden for 48 timer og sigter mod at
            løse kritiske problemer inden for 7 dage.
          </p>
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-5 text-sm space-y-1">
            <p className="font-semibold text-foreground">CVR-MATE</p>
            <p>Sikkerhedskontakt: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
          </div>
        </>
      ) : (
        <>
          <p>
            Found a security vulnerability? We encourage responsible disclosure. Send a detailed report to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium underline underline-offset-2">{CONTACT_EMAIL}</a>{" "}
            with the subject &quot;Security Report&quot;. We acknowledge receipt within 48 hours and aim to resolve
            critical issues within 7 days.
          </p>
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-5 text-sm space-y-1">
            <p className="font-semibold text-foreground">CVR-MATE</p>
            <p>Security contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
          </div>
        </>
      ),
  },
];

export function DataSecurityContent() {
  return (
    <LegalPageShell
      page="data-security"
      daTitle="Datasikkerhed"
      enTitle="Data Security"
      daSubtitle="Sådan beskytter CVR-MATE dine data — kryptering, adgangskontrol, infrastruktur og compliance."
      enSubtitle="How CVR-MATE protects your data — encryption, access control, infrastructure, and compliance."
      effectiveDate={EFFECTIVE_DATE}
      sections={sections}
    />
  );
}
