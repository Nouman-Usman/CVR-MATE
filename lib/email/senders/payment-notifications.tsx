import "server-only";

import { render } from "@react-email/render";
import { sendEmail } from "../mailer";
import type { SendEmailResult } from "../types";

// ─── Email Templates ────────────────────────────────────────────────────────

interface PaymentFailedEmailProps {
  userName: string;
  failureReason: string;
  nextRetryDate?: string;
}

function PaymentFailedEmail({ userName, failureReason, nextRetryDate }: PaymentFailedEmailProps) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px" }}>
      <h2>Payment Failed</h2>
      <p>Hi {userName},</p>
      <p>
        Your recent payment attempt failed due to: <strong>{failureReason}</strong>
      </p>
      {nextRetryDate && (
        <p>
          We'll automatically retry on <strong>{nextRetryDate}</strong>. Please update your payment
          method if the issue persists.
        </p>
      )}
      <p>
        <a href="https://cvr-mate.dk/settings?tab=billing" style={{ color: "#0066cc" }}>
          Update Payment Method
        </a>
      </p>
      <p>Questions? Reply to this email or contact support.</p>
    </div>
  );
}

interface CardExpiringEmailProps {
  userName: string;
  expiryDate: string;
}

function CardExpiringEmail({ userName, expiryDate }: CardExpiringEmailProps) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px" }}>
      <h2>Card Expiring Soon</h2>
      <p>Hi {userName},</p>
      <p>Your payment card expires on {expiryDate}. To avoid service interruption, please update it.</p>
      <p>
        <a href="https://cvr-mate.dk/settings?tab=billing" style={{ color: "#0066cc" }}>
          Update Payment Method
        </a>
      </p>
    </div>
  );
}

interface PaymentActionRequiredEmailProps {
  userName: string;
  actionType: string;
}

function PaymentActionRequiredEmail({ userName, actionType }: PaymentActionRequiredEmailProps) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px" }}>
      <h2>Action Required: Confirm Payment</h2>
      <p>Hi {userName},</p>
      <p>
        Your payment requires additional authentication ({actionType}). Please complete verification
        to avoid service interruption.
      </p>
      <p>
        <a href="https://cvr-mate.dk/settings?tab=billing" style={{ color: "#0066cc" }}>
          Complete Payment
        </a>
      </p>
    </div>
  );
}

interface InvoiceUpcomingEmailProps {
  userName: string;
  amount: number;
  currency: string;
  daysUntil: number;
  planName: string;
}

function InvoiceUpcomingEmail({ userName, amount, currency, daysUntil, planName }: InvoiceUpcomingEmailProps) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px" }}>
      <h2>Upcoming Invoice</h2>
      <p>Hi {userName},</p>
      <p>
        Your next invoice for <strong>{planName}</strong> will be charged in <strong>{daysUntil} days</strong>.
      </p>
      <p>
        Amount: <strong>
          {currency} {amount.toFixed(2)}
        </strong>
      </p>
      <p>
        <a href="https://cvr-mate.dk/settings?tab=billing" style={{ color: "#0066cc" }}>
          View Billing Details
        </a>
      </p>
    </div>
  );
}

interface DisputeEmailProps {
  userName: string;
  amount: number;
  currency: string;
}

function DisputeEmail({ userName, amount, currency }: DisputeEmailProps) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px" }}>
      <h2>Payment Dispute Reported</h2>
      <p>Hi {userName},</p>
      <p>
        A dispute has been filed against a charge of {currency} {amount.toFixed(2)} on your account.
      </p>
      <p>
        Please contact us immediately if you have questions or need to provide evidence to resolve this.
      </p>
      <p>
        <a href="mailto:support@cvr-mate.dk" style={{ color: "#0066cc" }}>
          Contact Support
        </a>
      </p>
    </div>
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
  const template = PaymentFailedEmail({
    userName: opts.userName,
    failureReason: opts.failureReason,
    nextRetryDate: opts.nextRetryDate,
  });

  return sendEmail(template, {
    to: opts.to,
    userId: opts.userId,
    subject: "Payment Failed – Action Required",
    templateId: "payment_failed",
  });
}

export async function sendCardExpiringEmail(opts: {
  to: string;
  userName: string;
  userId: string;
  expiryDate: string;
}): Promise<SendEmailResult> {
  const template = CardExpiringEmail({
    userName: opts.userName,
    expiryDate: opts.expiryDate,
  });

  return sendEmail(template, {
    to: opts.to,
    userId: opts.userId,
    subject: "Card Expiring Soon",
    templateId: "card_expiring",
  });
}

export async function sendPaymentActionRequiredEmail(opts: {
  to: string;
  userName: string;
  userId: string;
  actionType: string;
}): Promise<SendEmailResult> {
  const template = PaymentActionRequiredEmail({
    userName: opts.userName,
    actionType: opts.actionType,
  });

  return sendEmail(template, {
    to: opts.to,
    userId: opts.userId,
    subject: "Action Required: Confirm Your Payment",
    templateId: "payment_action_required",
  });
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
  const template = InvoiceUpcomingEmail({
    userName: opts.userName,
    amount: opts.amount,
    currency: opts.currency,
    daysUntil: opts.daysUntil,
    planName: opts.planName,
  });

  return sendEmail(template, {
    to: opts.to,
    userId: opts.userId,
    subject: `Upcoming Invoice: ${opts.planName}`,
    templateId: "invoice_upcoming",
  });
}

export async function sendDisputeEmail(opts: {
  to: string;
  userName: string;
  userId: string;
  amount: number;
  currency: string;
}): Promise<SendEmailResult> {
  const template = DisputeEmail({
    userName: opts.userName,
    amount: opts.amount,
    currency: opts.currency,
  });

  return sendEmail(template, {
    to: opts.to,
    userId: opts.userId,
    subject: "Payment Dispute Reported",
    templateId: "dispute",
  });
}
