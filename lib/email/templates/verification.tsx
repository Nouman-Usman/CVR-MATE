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
import { en, da } from "@/lib/i18n";

interface VerificationEmailProps {
  userName: string;
  verificationUrl: string;
  language?: "en" | "da";
}

export function VerificationEmail({
  userName,
  verificationUrl,
  language = "en",
}: VerificationEmailProps) {
  const t = language === "da" ? da : en;
  const lang = language === "da" ? "da" : "en";

  return (
    <Html lang={lang}>
      <Head />
      <Preview>{t.email.verification.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logoText}>CVR-MATE</Text>
          </Section>

          <Section style={content}>
            <Heading style={heading}>{t.email.verification.heading}</Heading>
            <Text style={paragraph}>{t.email.verification.greeting.replace("{name}", userName)}</Text>
            <Text style={paragraph}>{t.email.verification.intro}</Text>

            <Section style={buttonContainer}>
              <Button style={button} href={verificationUrl}>
                {t.email.verification.button}
              </Button>
            </Section>

            <Text style={hint}>{t.email.verification.hint}</Text>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>{t.email.verification.fallback}</Text>
            <Link href={verificationUrl} style={footerLink}>
              {verificationUrl}
            </Link>
            <Text style={footerText}>
              {t.email.verification.copyright.replace("{year}", new Date().getFullYear().toString())}
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
  margin: "0 0 20px",
  letterSpacing: "-0.3px",
};

const paragraph: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const buttonContainer: React.CSSProperties = {
  margin: "28px 0",
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

const hint: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "16px 0 0",
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
  margin: "0 0 8px",
};

const footerLink: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "11px",
  wordBreak: "break-all",
};
