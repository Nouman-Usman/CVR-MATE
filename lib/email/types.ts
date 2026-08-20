export type EmailProvider = "resend";

export type EmailTemplateId =
  | "email_verification"
  | "password_reset"
  | "welcome"
  | "team_invitation"
  | "daily_lead_update"
  | "match_feed"
  | "weekly_summary"
  | "annual_report_digest"
  | "payment_succeeded"
  | "payment_failed"
  | "subscription_updated"
  | "subscription_canceled"
  | "card_expiring"
  | "payment_action_required"
  | "invoice_upcoming"
  | "dispute"
  // Sent to an external customer, not a platform user — logs with userId null.
  | "quote_sent";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  templateId?: EmailTemplateId;
  userId?: string;
}

export interface SendEmailResult {
  provider: EmailProvider;
  messageId?: string;
}

export interface EmailProviderClient {
  send(opts: SendEmailOptions): Promise<SendEmailResult>;
}

// ─── QStash payload for /api/email/notify ─────────────────────────────────

export interface EmailQueuePayload {
  templateId:
    | "daily_lead_update"
    | "weekly_summary"
    | "match_feed"
    | "annual_report_digest";
  userId: string;
  data:
    | DailyLeadUpdateData
    | WeeklySummaryData
    | MatchFeedReadyData
    | AnnualReportDigestData;
}

/** One followed company's newly-filed annual report, for the daily digest. */
export interface AnnualReportDigestReport {
  cvr: string;
  companyName: string;
  /** Canonical identity — never publicdate. */
  periodEnd: string;
  /** Metadata: enables "filed N days late". */
  publicdate: string | null;
  documentUrl: string | null;
  /** Null on 45% of filings, including Novo's — the email must still render. */
  summary: {
    revenue: number | null;
    grossprofitloss: number | null;
    profitloss: number | null;
    equity: number | null;
    assets: number | null;
    averagenumberofemployees: number | null;
  } | null;
}

export interface AnnualReportDigestData {
  reportCount: number;
  reports: AnnualReportDigestReport[];
}

export interface DailyLeadUpdateData {
  triggerName: string;
  triggerId: string;
  matchCount: number;
  companies: { vat: string; name: string; city: string; industry: string }[];
}

/** Payload for the daily "your match feed is ready" email. */
export interface MatchFeedReadyData {
  matchCount: number;
  companies: { vat: string; name: string; city: string; industry: string }[];
}

export interface WeeklySummaryData {
  periodStart: string; // ISO date
  periodEnd: string;
  totalLeads: number;
  topTriggers: { name: string; count: number }[];
  savedCompaniesCount: number;
}

// ─── Resend webhook event (subset we handle) ──────────────────────────────

export type ResendWebhookEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.complained"
  | "email.bounced"
  | "email.opened"
  | "email.clicked";

export interface ResendWebhookEvent {
  type: ResendWebhookEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    // bounce-specific
    bounce?: { message?: string };
    // click-specific
    click?: { link?: string };
  };
}
