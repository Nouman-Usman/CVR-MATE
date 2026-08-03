import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import type { MatchFeedReadyData } from "../types";

interface MatchFeedReadyEmailProps {
  userName: string;
  baseUrl: string;
  matchesUrl: string;
  data: MatchFeedReadyData;
  language?: "en" | "da";
}

/**
 * "Your daily matches are ready" email. Mirrors the daily-lead-update styling
 * but with match-feed copy and a CTA to /matches (the swipe deck). Bilingual
 * inline so it carries no i18n dependency.
 */
export function MatchFeedReadyEmail({
  userName,
  baseUrl,
  matchesUrl,
  data,
  language = "da",
}: MatchFeedReadyEmailProps) {
  const lang = language === "da" ? "da" : "en";
  const n = data.matchCount;
  const matchWord = n === 1 ? "match" : "matches";
  const companyWord =
    language === "da"
      ? n === 1
        ? "virksomhed"
        : "virksomheder"
      : n === 1
      ? "company"
      : "companies";

  const preview =
    language === "da"
      ? `${n} nye ${matchWord} matchet til din virksomhed i dag`
      : `${n} new ${matchWord} matched to your business today`;

  return (
    <Html lang={lang}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>CVR-MATE</Text>
          </Section>

          <Section style={content}>
            <Heading style={heading}>
              {n} {language === "da" ? "nye" : "new"} {matchWord}
            </Heading>
            <Text style={paragraph}>
              {language === "da" ? "Hej" : "Hi"} {userName},{" "}
              {language === "da"
                ? `vi har matchet ${n} ${companyWord} til din virksomhed i dag. Gennemgå dem og gem dem, der passer.`
                : `we matched ${n} ${companyWord} to your business today. Swipe through and save the ones that fit.`}
            </Text>

            {/* Company cards — each links to /company/[vat] */}
            {data.companies.slice(0, 10).map((c, i) => (
              <Link key={i} href={`${baseUrl}/company/${c.vat}`} style={cardLink}>
                <Text style={companyName}>{c.name}</Text>
                <Text style={companyMeta}>
                  {[c.city, c.industry].filter(Boolean).join(" · ")}
                  {c.vat ? ` · CVR ${c.vat}` : null}
                </Text>
              </Link>
            ))}

            <Section style={buttonContainer}>
              <Button style={button} href={matchesUrl}>
                {language === "da" ? "Se dine matches" : "View your matches"}
              </Button>
            </Section>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} CVR-MATE.{" "}
              {language === "da"
                ? "Du modtager denne e-mail, fordi daglige lead-opdateringer er slået til."
                : "You're receiving this because daily lead updates are on."}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Styles (mirrors daily-lead-update.tsx) ──────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: "#F9FAFB",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "40px auto",
  maxWidth: "560px",
  borderRadius: "8px",
  border: "1px solid #E5E7EB",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  backgroundColor: "#1D4ED8",
  padding: "24px 32px",
};

const logoText: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: "700",
  margin: 0,
  letterSpacing: "-0.3px",
};

const content: React.CSSProperties = {
  padding: "32px 32px 24px",
};

const heading: React.CSSProperties = {
  color: "#111827",
  fontSize: "22px",
  fontWeight: "700",
  margin: "0 0 12px",
  letterSpacing: "-0.3px",
};

const paragraph: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 24px",
};

// Block-level link styled as a card — email-safe: display:block on <a>
const cardLink: React.CSSProperties = {
  display: "block",
  backgroundColor: "#F9FAFB",
  borderRadius: "6px",
  border: "1px solid #E5E7EB",
  padding: "12px 16px",
  marginBottom: "8px",
  textDecoration: "none",
  cursor: "pointer",
};

const companyName: React.CSSProperties = {
  color: "#111827",
  fontSize: "14px",
  fontWeight: "600",
  margin: "0 0 2px",
  textDecoration: "none",
};

const companyMeta: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "13px",
  margin: 0,
  textDecoration: "none",
};

const buttonContainer: React.CSSProperties = {
  margin: "24px 0 0",
};

const button: React.CSSProperties = {
  backgroundColor: "#1D4ED8",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: "600",
  padding: "12px 24px",
  textDecoration: "none",
};

const divider: React.CSSProperties = {
  borderColor: "#E5E7EB",
  margin: 0,
};

const footer: React.CSSProperties = {
  padding: "20px 32px",
};

const footerText: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "12px",
  lineHeight: "18px",
  margin: 0,
};
