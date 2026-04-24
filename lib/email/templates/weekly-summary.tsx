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
import * as React from "react";
import type { WeeklySummaryData } from "../types";
import { en, da } from "@/lib/i18n";

interface WeeklySummaryEmailProps {
  userName: string;
  dashboardUrl: string;
  data: WeeklySummaryData;
  language?: "en" | "da";
}

export function WeeklySummaryEmail({
  userName,
  dashboardUrl,
  data,
  language = "en",
}: WeeklySummaryEmailProps) {
  const t = language === "da" ? da : en;
  const lang = language === "da" ? "da" : "en";

  const periodLabel = `${formatDate(data.periodStart, lang)} – ${formatDate(data.periodEnd, lang)}`;

  return (
    <Html lang={lang}>
      <Head />
      <Preview>
        {language === "da"
          ? `Din CVR-MATE ugentlige sammenfatning: ${data.totalLeads} leads fundet (${periodLabel})`
          : `Your CVR-MATE weekly summary: ${data.totalLeads} leads found (${periodLabel})`}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>CVR-MATE</Text>
            <Text style={headerSubtitle}>
              {language === "da" ? "Ugentlig sammenfatning" : "Weekly summary"}
            </Text>
          </Section>

          <Section style={content}>
            <Heading style={heading}>
              {language === "da" ? "Din uge i leads" : "Your week in leads"}
            </Heading>
            <Text style={paragraph}>
              {language === "da"
                ? `Hej ${userName}, her er hvad der skete på CVR-MATE denne uge (${periodLabel}).`
                : `Hi ${userName}, here's what happened on CVR-MATE this week (${periodLabel}).`}
            </Text>

            {/* Stat cards */}
            <Section style={statsRow}>
              <StatCard
                value={String(data.totalLeads)}
                label={t.email.weeklySummary.totalLeads}
                color="#1D4ED8"
              />
              <StatCard
                value={String(data.savedCompaniesCount)}
                label={t.email.weeklySummary.savedCompanies}
                color="#0891B2"
              />
            </Section>

            {/* Top triggers */}
            {data.topTriggers.length > 0 && (
              <>
                <Text style={sectionLabel}>
                  {t.email.weeklySummary.topTriggers}
                </Text>
                {data.topTriggers.slice(0, 5).map((t, i) => (
                  <Section key={i} style={triggerRow}>
                    <Text style={triggerName}>{t.name}</Text>
                    <Text style={triggerCount}>
                      {t.count} {language === "da" ? "matches" : "matches"}
                    </Text>
                  </Section>
                ))}
              </>
            )}

            <Section style={buttonContainer}>
              <Button style={button} href={dashboardUrl}>
                {t.email.weeklySummary.viewDashboard}
              </Button>
            </Section>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              {t.email.weeklySummary.copyright.replace("{year}", new Date().getFullYear().toString())}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <Section
      style={{
        backgroundColor: "#F9FAFB",
        border: "1px solid #E5E7EB",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "12px",
      }}
    >
      <Text
        style={{
          color,
          fontSize: "28px",
          fontWeight: "700",
          margin: "0 0 4px",
          letterSpacing: "-0.5px",
        }}
      >
        {value}
      </Text>
      <Text style={{ color: "#6B7280", fontSize: "13px", margin: 0 }}>
        {label}
      </Text>
    </Section>
  );
}

function formatDate(iso: string, lang: "en" | "da" = "en") {
  try {
    const locale = lang === "da" ? "da-DK" : "en-GB";
    return new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
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
  backgroundColor: "#0F172A",
  padding: "24px 32px",
};

const logoText: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: "700",
  margin: "0 0 4px",
  letterSpacing: "-0.3px",
};

const headerSubtitle: React.CSSProperties = {
  color: "#94A3B8",
  fontSize: "13px",
  margin: 0,
  fontWeight: "500",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
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

const statsRow: React.CSSProperties = {
  marginBottom: "24px",
};

const sectionLabel: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.8px",
  margin: "0 0 10px",
  textTransform: "uppercase",
};

const triggerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #F3F4F6",
  padding: "8px 0",
};

const triggerName: React.CSSProperties = {
  color: "#111827",
  fontSize: "14px",
  fontWeight: "500",
  margin: 0,
};

const triggerCount: React.CSSProperties = {
  color: "#1D4ED8",
  fontSize: "13px",
  fontWeight: "600",
  margin: 0,
};

const buttonContainer: React.CSSProperties = {
  margin: "28px 0 0",
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
