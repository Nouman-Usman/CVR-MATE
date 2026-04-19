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

interface WelcomeEmailProps {
  userName: string;
  dashboardUrl: string;
}

export function WelcomeEmail({ userName, dashboardUrl }: WelcomeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to CVR-MATE — your Danish lead intelligence platform</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logoText}>CVR-MATE</Text>
          </Section>

          <Section style={content}>
            <Heading style={heading}>Welcome, {userName}!</Heading>
            <Text style={paragraph}>
              Your account is ready. CVR-MATE gives you real-time intelligence on 700,000+
              Danish companies — so you can find the right leads at the right time.
            </Text>

            <Section style={stepsContainer}>
              <Step number="1" title="Search companies" description="Filter by industry, size, location, and financial health to build your ideal prospect list." />
              <Step number="2" title="Set up triggers" description="Get notified when companies matching your criteria change — new hires, growth signals, and more." />
              <Step number="3" title="Push to your CRM" description="Sync enriched company data and contacts directly to HubSpot, Pipedrive, or GoHighLevel." />
            </Section>

            <Section style={buttonContainer}>
              <Button style={button} href={dashboardUrl}>
                Go to your dashboard
              </Button>
            </Section>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              &copy; {new Date().getFullYear()} CVR-MATE. All rights reserved.
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
