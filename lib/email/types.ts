export type EmailProvider = "sendgrid" | "gmail";

export type EmailTemplateId =
  | "email_verification"
  | "password_reset"
  | "welcome"
  | "team_invitation"
  | "daily_lead_update"
  | "weekly_summary";

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
  templateId: "daily_lead_update" | "weekly_summary";
  userId: string;
  data: DailyLeadUpdateData | WeeklySummaryData;
}

export interface DailyLeadUpdateData {
  triggerName: string;
  triggerId: string;
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

// ─── SendGrid webhook event (subset we handle) ────────────────────────────

export interface SendGridWebhookEvent {
  email: string;
  timestamp: number;
  event:
    | "delivered"
    | "bounce"
    | "dropped"
    | "deferred"
    | "open"
    | "click"
    | "unsubscribe"
    | "spamreport";
  sg_message_id?: string;
  reason?: string;
  status?: string;
  url?: string;
}
