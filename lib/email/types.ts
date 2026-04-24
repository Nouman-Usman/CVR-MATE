export type EmailProvider = "resend";

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
