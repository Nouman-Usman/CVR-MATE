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
import type { DailyLeadUpdateData } from "../types";

interface DailyLeadUpdateEmailProps {
  userName: string;
  baseUrl: string;
  triggersUrl: string;
  data: DailyLeadUpdateData;
}

export function DailyLeadUpdateEmail({
  userName,
  baseUrl,
  triggersUrl,
  data,
}: DailyLeadUpdateEmailProps) {
  const preview =
    data.matchCount === 1
      ? `1 new company matched "${data.triggerName}"`
      : `${data.matchCount} new companies matched "${data.triggerName}"`;

  return (
    <Html lang="en">
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
              {data.matchCount} new{" "}
              {data.matchCount === 1 ? "match" : "matches"}
            </Heading>
            <Text style={paragraph}>
              Hi {userName}, your trigger{" "}
              <strong>&ldquo;{data.triggerName}&rdquo;</strong> found{" "}
              {data.matchCount} new{" "}
              {data.matchCount === 1 ? "company" : "companies"} since your last
              update.
            </Text>

            {/* Company cards — each links to /company/[vat] */}
            {data.companies.slice(0, 10).map((c, i) => (
              <Link
                key={i}
                href={`${baseUrl}/company/${c.vat}`}
                style={cardLink}
              >
                <Text style={companyName}>{c.name}</Text>
                <Text style={companyMeta}>
                  {[c.city, c.industry].filter(Boolean).join(" · ")}
                  {c.vat
                    ? ` · CVR ${c.vat}`
                    : null}
                </Text>
              </Link>
            ))}

            {data.matchCount > 10 && (
              <Text style={moreText}>
                +{data.matchCount - 10} more companies in the app
              </Text>
            )}

            <Section style={buttonContainer}>
              <Button style={button} href={triggersUrl}>
                View all matches
              </Button>
            </Section>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              You&apos;re receiving this because you enabled email notifications
              for triggers. &nbsp;·&nbsp;{" "}
              &copy; {new Date().getFullYear()} CVR-MATE
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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

const moreText: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "13px",
  margin: "8px 0 24px",
  fontStyle: "italic",
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
