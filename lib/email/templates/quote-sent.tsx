import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface QuoteSentEmailProps {
  language: "da" | "en";
  sellerName: string;
  customerName: string;
  quoteNumber: string;
  /** Pre-formatted with the recipient's currency — the template does no math. */
  totalFormatted: string;
  validUntil: string | null;
  /** Absolute URL of the public quote page. */
  quoteUrl: string;
  /** Optional free-text note from the sender. */
  message: string | null;
}

const copy = {
  da: {
    preview: (n: string, s: string) => `Tilbud ${n} fra ${s}`,
    heading: (n: string) => `Tilbud ${n}`,
    intro: (s: string) => `${s} har sendt dig et tilbud.`,
    total: "Samlet beløb inkl. moms",
    validUntil: "Gyldigt til",
    cta: "Se og besvar tilbuddet",
    fallback: "Virker knappen ikke? Kopiér dette link:",
    footer: "Du kan acceptere eller afvise tilbuddet direkte fra siden.",
  },
  en: {
    preview: (n: string, s: string) => `Quote ${n} from ${s}`,
    heading: (n: string) => `Quote ${n}`,
    intro: (s: string) => `${s} has sent you a quote.`,
    total: "Total incl. VAT",
    validUntil: "Valid until",
    cta: "View and respond to the quote",
    fallback: "Button not working? Copy this link:",
    footer: "You can accept or decline the quote directly from the page.",
  },
};

export function QuoteSentEmail({
  language,
  sellerName,
  customerName,
  quoteNumber,
  totalFormatted,
  validUntil,
  quoteUrl,
  message,
}: QuoteSentEmailProps) {
  const t = copy[language];

  return (
    <Html lang={language}>
      <Head />
      <Preview>{t.preview(quoteNumber, sellerName)}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>{t.heading(quoteNumber)}</Heading>
          <Text style={text}>
            {customerName ? `${customerName} — ` : ""}
            {t.intro(sellerName)}
          </Text>

          {message && (
            <Section style={quoteBox}>
              <Text style={quoteText}>{message}</Text>
            </Section>
          )}

          <Section style={summary}>
            <Text style={summaryRow}>
              <strong>{t.total}:</strong> {totalFormatted}
            </Text>
            {validUntil && (
              <Text style={summaryRow}>
                <strong>{t.validUntil}:</strong> {validUntil}
              </Text>
            )}
          </Section>

          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button style={button} href={quoteUrl}>
              {t.cta}
            </Button>
          </Section>

          <Text style={muted}>{t.fallback}</Text>
          <Text style={link}>{quoteUrl}</Text>

          <Hr style={hr} />
          <Text style={muted}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: "#f6f7f9", fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif" };
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "32px",
  maxWidth: "560px",
  borderRadius: "12px",
};
const heading = { fontSize: "22px", fontWeight: 700, color: "#0f172a", margin: "0 0 12px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#334155", margin: "0 0 16px" };
const quoteBox = {
  borderLeft: "3px solid #cbd5e1",
  padding: "4px 14px",
  margin: "0 0 20px",
};
const quoteText = { fontSize: "14px", lineHeight: "22px", color: "#475569", margin: 0, whiteSpace: "pre-wrap" as const };
const summary = { backgroundColor: "#f8fafc", borderRadius: "8px", padding: "14px 16px" };
const summaryRow = { fontSize: "14px", color: "#334155", margin: "0 0 4px" };
const button = {
  backgroundColor: "#2563eb",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 22px",
  textDecoration: "none",
};
const muted = { fontSize: "12px", color: "#94a3b8", margin: "0 0 4px" };
const link = { fontSize: "12px", color: "#2563eb", wordBreak: "break-all" as const, margin: "0 0 8px" };
const hr = { borderColor: "#e2e8f0", margin: "24px 0 16px" };
