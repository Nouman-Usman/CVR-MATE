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
import { en, da } from "@/lib/i18n";

interface WelcomeEmailProps {
  userName: string;
  dashboardUrl: string;
  language?: "en" | "da";
}

export function WelcomeEmail({
  userName,
  dashboardUrl,
  language = "en",
}: WelcomeEmailProps) {
  const t = language === "da" ? da : en;
  const lang = language === "da" ? "da" : "en";

  return (
    <Html lang={lang}>
      <Head />
      <Preview>{t.email.welcome.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logoText}>CVR-MATE</Text>
          </Section>

          <Section style={content}>
            <Heading style={heading}>
              {t.email.welcome.greeting.replace("{name}", userName)}
            </Heading>
            <Text style={paragraph}>{t.email.welcome.intro}</Text>

            <Section style={stepsContainer}>
              <Step
                number="1"
                title={t.email.welcome.step1Title}
                description={t.email.welcome.step1Desc}
              />
              <Step
                number="2"
                title={t.email.welcome.step2Title}
                description={t.email.welcome.step2Desc}
              />
              <Step
                number="3"
                title={t.email.welcome.step3Title}
                description={t.email.welcome.step3Desc}
              />
            </Section>

            <Section style={buttonContainer}>
              <Button style={button} href={dashboardUrl}>
                {t.email.welcome.button}
              </Button>
            </Section>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              {t.email.welcome.copyright.replace("{year}", new Date().getFullYear().toString())}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <Section style={stepRow}>
      <Text style={stepNumber}>{number}</Text>
      <Section style={stepContent}>
        <Text style={stepTitle}>{title}</Text>
        <Text style={stepDescription}>{description}</Text>
      </Section>
    </Section>
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

const logoSection: React.CSSProperties = {
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
  margin: "0 0 28px",
};

const stepsContainer: React.CSSProperties = {
  margin: "0 0 28px",
};

const stepRow: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  marginBottom: "16px",
};

const stepNumber: React.CSSProperties = {
  backgroundColor: "#EFF6FF",
  borderRadius: "50%",
  color: "#1D4ED8",
  display: "inline-block",
  fontSize: "13px",
  fontWeight: "700",
  height: "28px",
  lineHeight: "28px",
  margin: "0 12px 0 0",
  minWidth: "28px",
  textAlign: "center",
  width: "28px",
};

const stepContent: React.CSSProperties = {
  flex: 1,
};

const stepTitle: React.CSSProperties = {
  color: "#111827",
  fontSize: "14px",
  fontWeight: "600",
  margin: "0 0 2px",
};

const stepDescription: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "13px",
  lineHeight: "20px",
  margin: 0,
};

const buttonContainer: React.CSSProperties = {
  margin: "8px 0 0",
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
  margin: "0",
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
