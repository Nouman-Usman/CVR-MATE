import "server-only";

import { render, toPlainText } from "@react-email/render";
import type { ReactElement } from "react";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import { createResendProvider } from "./providers/resend";
import { createGmailProvider } from "./providers/gmail";
import type { EmailProvider, SendEmailOptions, SendEmailResult } from "./types";

async function writeEmailLog(
  opts: SendEmailOptions,
  provider: EmailProvider | null,
  messageId: string | null | undefined,
  status: "sent" | "failed",
  error: string | null
) {
  try {
    await db.insert(emailLog).values({
      userId: opts.userId ?? null,
      to: Array.isArray(opts.to) ? opts.to[0] : opts.to,
      subject: opts.subject,
      templateId: opts.templateId ?? null,
      provider: provider ?? null,
      messageId: messageId ?? null,
      status,
      error,
    });
  } catch (logErr) {
    console.error("[email] Failed to write emailLog:", logErr);
  }
}

/** True when at least one Gmail credential is configured. */
function isGmailConfigured(): boolean {
  return !!(
    process.env.SMTP_USER ||
    process.env.GMAIL_USER ||
    process.env.GMAIL_OAUTH2_CLIENT_ID
  );
}

/**
 * Send a transactional email.
 * Tries Resend first; falls back to Gmail (nodemailer) if Resend fails or is
 * not configured. Both attempts are logged to the email_log table.
 *
 * @param template  A React Email component instance (e.g. <VerificationEmail ... />)
 * @param opts      Recipient, subject, templateId for logging
 */
export async function sendEmail(
  template: ReactElement,
  opts: Omit<SendEmailOptions, "html" | "text">
): Promise<SendEmailResult> {
  const html = await render(template);
  const text = toPlainText(html);
  const fullOpts: SendEmailOptions = { ...opts, html, text };

  // ── Primary: Resend ────────────────────────────────────────────────────────
  if (process.env.RESEND_API_KEY) {
    try {
      const result = await createResendProvider().send(fullOpts);
      await writeEmailLog(fullOpts, result.provider, result.messageId, "sent", null);
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[email] Resend failed, falling back to Gmail: ${errMsg}`);
      await writeEmailLog(fullOpts, "resend", null, "failed", errMsg);
      // fall through to Gmail
    }
  }

  // ── Fallback: Gmail / SMTP ─────────────────────────────────────────────────
  if (isGmailConfigured()) {
    try {
      const result = await createGmailProvider().send(fullOpts);
      await writeEmailLog(fullOpts, result.provider, result.messageId, "sent", null);
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await writeEmailLog(fullOpts, "gmail", null, "failed", errMsg);
      throw new Error(`[email] All providers failed. Gmail error: ${errMsg}`);
    }
  }

  // ── No provider configured ─────────────────────────────────────────────────
  const noProviderMsg = "No email provider configured. Set RESEND_API_KEY or Gmail credentials.";
  await writeEmailLog(fullOpts, null, null, "failed", noProviderMsg);
  throw new Error(`[email] ${noProviderMsg}`);
}
