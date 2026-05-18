import "server-only";

import * as React from "react";
import { sendEmail } from "../mailer";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { eq } from "drizzle-orm";
import type { SendEmailResult } from "../types";

type Lang = "da" | "en";

async function getUserLanguage(userId: string): Promise<Lang> {
  try {
    const record = await db.query.user.findFirst({ where: eq(user.id, userId) });
    return (record?.language as Lang) || "da";
  } catch {
    return "da";
  }
}

// ─── Translations ────────────────────────────────────────────────────────────

const copy = {
  da: {
    greeting: (name: string) => `Hej ${name},`,
    paymentFailed: {
      subject: "Betaling mislykkedes – handling krævet",
      heading: "Betaling mislykkedes",
      reason: (r: string) => `Dit seneste betalingsforsøg mislykkedes på grund af: ${r}.`,
      retry: (date: string) => `Vi prøver automatisk igen den ${date}. Opdater venligst din betalingsmetode, hvis problemet fortsætter.`,
      cta: "Opdater betalingsmetode",
      footer: "Spørgsmål? Kontakt os på support@cvr-mate.dk",
    },
    cardExpiring: {
      subject: "Dit betalingskort udløber snart",
      heading: "Betalingskort udløber snart",
      body: (date: string) => `Dit betalingskort udløber den ${date}. Opdater venligst din betalingsmetode for at undgå afbrydelse af tjenesten.`,
      cta: "Opdater betalingsmetode",
    },
    paymentAction: {
      subject: "Handling krævet: Bekræft din betaling",
      heading: "Handling krævet: Bekræft betaling",
      body: (type: string) => `Din betaling kræver yderligere godkendelse (${type}). Gennemfør venligst bekræftelsen for at undgå afbrydelse af tjenesten.`,
      cta: "Gennemfør betaling",
    },
    invoiceUpcoming: {
      subject: (plan: string) => `Kommende faktura: ${plan}`,
      heading: "Kommende faktura",
      body: (plan: string, days: number) =>
        `Din næste faktura for ${plan} vil blive opkrævet om ${days} ${days === 1 ? "dag" : "dage"}.`,
      amountLabel: "Beløb:",
      cta: "Se faktureringsoplysninger",
    },
    dispute: {
      subject: "Betalingsindsigelse registreret",
      heading: "Betalingsindsigelse registreret",
      body: (curr: string, amt: string) =>
        `En indsigelse er blevet indsendt mod en opkrævning på ${curr} ${amt} på din konto.`,
      instructions:
        "Kontakt os straks, hvis du har spørgsmål eller skal fremlægge dokumentation for at løse indsigelsen.",
      cta: "Kontakt support",
    },
    signature: "Med venlig hilsen,\nCVR-MATE-teamet",
  },
  en: {
    greeting: (name: string) => `Hi ${name},`,
    paymentFailed: {
      subject: "Payment Failed – Action Required",
      heading: "Payment Failed",
      reason: (r: string) => `Your recent payment attempt failed due to: ${r}.`,
      retry: (date: string) => `We'll automatically retry on ${date}. Please update your payment method if the issue persists.`,
      cta: "Update Payment Method",
      footer: "Questions? Contact us at support@cvr-mate.dk",
    },
    cardExpiring: {
      subject: "Card Expiring Soon",
      heading: "Card Expiring Soon",
      body: (date: string) => `Your payment card expires on ${date}. Please update your payment method to avoid service interruption.`,
      cta: "Update Payment Method",
    },
    paymentAction: {
      subject: "Action Required: Confirm Your Payment",
      heading: "Action Required: Confirm Payment",
      body: (type: string) => `Your payment requires additional authentication (${type}). Please complete verification to avoid service interruption.`,
      cta: "Complete Payment",
    },
    invoiceUpcoming: {
      subject: (plan: string) => `Upcoming Invoice: ${plan}`,
      heading: "Upcoming Invoice",
      body: (plan: string, days: number) =>
        `Your next invoice for ${plan} will be charged in ${days} ${days === 1 ? "day" : "days"}.`,
      amountLabel: "Amount:",
      cta: "View Billing Details",
    },
    dispute: {
      subject: "Payment Dispute Reported",
      heading: "Payment Dispute Reported",
      body: (curr: string, amt: string) =>
        `A dispute has been filed against a charge of ${curr} ${amt} on your account.`,
      instructions:
        "Please contact us immediately if you have questions or need to provide evidence to resolve this dispute.",
      cta: "Contact Support",
    },
    signature: "Best regards,\nThe CVR-MATE Team",
  },
};

// ─── Shared email wrapper ────────────────────────────────────────────────────

const billingUrl = "https://cvr-mate.dk/settings?tab=billing";
const supportEmail = "mailto:support@cvr-mate.dk";

const containerStyle: React.CSSProperties = {
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  maxWidth: "560px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  color: "#1a1a2e",
};

const headerStyle: React.CSSProperties = {
  backgroundColor: "#0f172a",
  padding: "24px 32px",
  borderBottom: "3px solid #3b82f6",
};

const logoStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "18px",
  fontWeight: "700",
  letterSpacing: "-0.5px",
  textDecoration: "none",
};

const bodyStyle: React.CSSProperties = {
  padding: "32px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "700",
  color: "#0f172a",
  margin: "0 0 16px",
  lineHeight: "1.3",
};

const paraStyle: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#374151",
  margin: "0 0 16px",
};

const ctaStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#3b82f6",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: "600",
  fontSize: "14px",
  margin: "8px 0 24px",
};

const dividerStyle: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  margin: "24px 0",
};

const footerStyle: React.CSSProperties = {
  padding: "16px 32px 24px",
  fontSize: "12px",
  color: "#9ca3af",
  lineHeight: "1.5",
  borderTop: "1px solid #f3f4f6",
};

function EmailWrapper({
  lang,
  heading,
  children,
}: {
  lang: Lang;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <html lang={lang}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: "24px 0", backgroundColor: "#f8fafc" }}>
        <div style={containerStyle}>
          <div style={headerStyle}>
            <span style={logoStyle}>CVR-MATE</span>
          </div>
          <div style={bodyStyle}>
            <h1 style={headingStyle}>{heading}</h1>
            {children}
          </div>
          <div style={footerStyle}>
            <p style={{ margin: "0 0 4px" }}>CVR-MATE · cvr-mate.dk</p>
            <p style={{ margin: 0 }}>
              {lang === "da"
                ? "Dette er en automatisk besked fra din CVR-MATE-konto."
                : "This is an automated message from your CVR-MATE account."}
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}

// ─── Email Templates ────────────────────────────────────────────────────────

function PaymentFailedEmail({
  userName,
  failureReason,
  nextRetryDate,
  lang,
}: {
  userName: string;
  failureReason: string;
  nextRetryDate?: string;
  lang: Lang;
}) {
  const tr = copy[lang];
  const pf = tr.paymentFailed;
  return (
    <EmailWrapper lang={lang} heading={pf.heading}>
      <p style={paraStyle}>{tr.greeting(userName)}</p>
      <p style={paraStyle}>{pf.reason(failureReason)}</p>
      {nextRetryDate && <p style={paraStyle}>{pf.retry(nextRetryDate)}</p>}
      <a href={billingUrl} style={ctaStyle}>{pf.cta}</a>
      <div style={dividerStyle} />
      <p style={{ ...paraStyle, whiteSpace: "pre-line" }}>{tr.signature}</p>
    </EmailWrapper>
  );
}

function CardExpiringEmail({
  userName,
  expiryDate,
  lang,
}: {
  userName: string;
  expiryDate: string;
  lang: Lang;
}) {
  const tr = copy[lang];
  const ce = tr.cardExpiring;
  return (
    <EmailWrapper lang={lang} heading={ce.heading}>
      <p style={paraStyle}>{tr.greeting(userName)}</p>
      <p style={paraStyle}>{ce.body(expiryDate)}</p>
      <a href={billingUrl} style={ctaStyle}>{ce.cta}</a>
      <div style={dividerStyle} />
      <p style={{ ...paraStyle, whiteSpace: "pre-line" }}>{tr.signature}</p>
    </EmailWrapper>
  );
}

function PaymentActionRequiredEmail({
  userName,
  actionType,
  lang,
}: {
  userName: string;
  actionType: string;
  lang: Lang;
}) {
  const tr = copy[lang];
  const pa = tr.paymentAction;
  return (
    <EmailWrapper lang={lang} heading={pa.heading}>
      <p style={paraStyle}>{tr.greeting(userName)}</p>
      <p style={paraStyle}>{pa.body(actionType)}</p>
      <a href={billingUrl} style={ctaStyle}>{pa.cta}</a>
      <div style={dividerStyle} />
      <p style={{ ...paraStyle, whiteSpace: "pre-line" }}>{tr.signature}</p>
    </EmailWrapper>
  );
}

function InvoiceUpcomingEmail({
  userName,
  amount,
  currency,
  daysUntil,
  planName,
  lang,
}: {
  userName: string;
  amount: number;
  currency: string;
  daysUntil: number;
  planName: string;
  lang: Lang;
}) {
  const tr = copy[lang];
  const inv = tr.invoiceUpcoming;
  return (
    <EmailWrapper lang={lang} heading={inv.heading}>
      <p style={paraStyle}>{tr.greeting(userName)}</p>
      <p style={paraStyle}>{inv.body(planName, daysUntil)}</p>
      <p style={{ ...paraStyle, fontWeight: "600" }}>
        {inv.amountLabel}{" "}
        <span style={{ fontFamily: "monospace" }}>
          {currency.toUpperCase()} {amount.toFixed(2)}
        </span>
      </p>
      <a href={billingUrl} style={ctaStyle}>{inv.cta}</a>
      <div style={dividerStyle} />
      <p style={{ ...paraStyle, whiteSpace: "pre-line" }}>{tr.signature}</p>
    </EmailWrapper>
  );
}

function DisputeEmail({
  userName,
  amount,
  currency,
  lang,
}: {
  userName: string;
  amount: number;
  currency: string;
  lang: Lang;
}) {
  const tr = copy[lang];
  const dp = tr.dispute;
  const urgentHeadingStyle: React.CSSProperties = {
    ...headingStyle,
    color: "#dc2626",
  };
  return (
    <html lang={lang}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: "24px 0", backgroundColor: "#f8fafc" }}>
        <div style={containerStyle}>
          <div style={{ ...headerStyle, borderBottomColor: "#dc2626" }}>
            <span style={logoStyle}>CVR-MATE</span>
          </div>
          <div style={bodyStyle}>
            <h1 style={urgentHeadingStyle}>{dp.heading}</h1>
            <p style={paraStyle}>{tr.greeting(userName)}</p>
            <p style={paraStyle}>
              {dp.body(currency.toUpperCase(), amount.toFixed(2))}
            </p>
            <p style={paraStyle}>{dp.instructions}</p>
            <a href={supportEmail} style={{ ...ctaStyle, backgroundColor: "#dc2626" }}>
              {dp.cta}
            </a>
            <div style={dividerStyle} />
            <p style={{ ...paraStyle, whiteSpace: "pre-line" }}>{tr.signature}</p>
          </div>
          <div style={footerStyle}>
            <p style={{ margin: "0 0 4px" }}>CVR-MATE · cvr-mate.dk</p>
            <p style={{ margin: 0 }}>
              {lang === "da"
                ? "Dette er en automatisk besked fra din CVR-MATE-konto."
                : "This is an automated message from your CVR-MATE account."}
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}

// ─── Senders ────────────────────────────────────────────────────────────────

export async function sendPaymentFailedEmail(opts: {
  to: string;
  userName: string;
  userId: string;
  failureReason: string;
  nextRetryDate?: string;
}): Promise<SendEmailResult> {
  const lang = await getUserLanguage(opts.userId);
  const tr = copy[lang].paymentFailed;
  return sendEmail(
    React.createElement(PaymentFailedEmail, {
      userName: opts.userName,
      failureReason: opts.failureReason,
      nextRetryDate: opts.nextRetryDate,
      lang,
    }),
    { to: opts.to, userId: opts.userId, subject: tr.subject, templateId: "payment_failed" }
  );
}

export async function sendCardExpiringEmail(opts: {
  to: string;
  userName: string;
  userId: string;
  expiryDate: string;
}): Promise<SendEmailResult> {
  const lang = await getUserLanguage(opts.userId);
  return sendEmail(
    React.createElement(CardExpiringEmail, {
      userName: opts.userName,
      expiryDate: opts.expiryDate,
      lang,
    }),
    { to: opts.to, userId: opts.userId, subject: copy[lang].cardExpiring.subject, templateId: "card_expiring" }
  );
}

export async function sendPaymentActionRequiredEmail(opts: {
  to: string;
  userName: string;
  userId: string;
  actionType: string;
}): Promise<SendEmailResult> {
  const lang = await getUserLanguage(opts.userId);
  return sendEmail(
    React.createElement(PaymentActionRequiredEmail, {
      userName: opts.userName,
      actionType: opts.actionType,
      lang,
    }),
    { to: opts.to, userId: opts.userId, subject: copy[lang].paymentAction.subject, templateId: "payment_action_required" }
  );
}

export async function sendInvoiceUpcomingEmail(opts: {
  to: string;
  userName: string;
  userId: string;
  amount: number;
  currency: string;
  daysUntil: number;
  planName: string;
}): Promise<SendEmailResult> {
  const lang = await getUserLanguage(opts.userId);
  return sendEmail(
    React.createElement(InvoiceUpcomingEmail, {
      userName: opts.userName,
      amount: opts.amount,
      currency: opts.currency,
      daysUntil: opts.daysUntil,
      planName: opts.planName,
      lang,
    }),
    {
      to: opts.to,
      userId: opts.userId,
      subject: copy[lang].invoiceUpcoming.subject(opts.planName),
      templateId: "invoice_upcoming",
    }
  );
}

export async function sendDisputeEmail(opts: {
  to: string;
  userName: string;
  userId: string;
  amount: number;
  currency: string;
}): Promise<SendEmailResult> {
  const lang = await getUserLanguage(opts.userId);
  return sendEmail(
    React.createElement(DisputeEmail, {
      userName: opts.userName,
      amount: opts.amount,
      currency: opts.currency,
      lang,
    }),
    { to: opts.to, userId: opts.userId, subject: copy[lang].dispute.subject, templateId: "dispute" }
  );
}
