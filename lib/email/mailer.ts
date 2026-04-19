import "server-only";

import { render, toPlainText } from "@react-email/render";
import type { ReactElement } from "react";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import { createSendGridProvider } from "./providers/sendgrid";
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

/**
 * Send a transactional email with automatic SendGrid → Gmail fallback.
 * All sends (success and failure) are logged to the email_log table.
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

  let result: SendEmailResult | null = null;
  let lastError: unknown;

  // 1. Try SendGrid (primary)
  if (process.env.SENDGRID_API_KEY) {
    try {
      result = await createSendGridProvider().send(fullOpts);
    } catch (err) {
      lastError = err;
      console.error("[email] SendGrid failed, falling back to Gmail:", err);
    }
  }

  // 2. Fall back to Gmail/SMTP
  if (!result && (process.env.SMTP_USER || process.env.GMAIL_OAUTH2_CLIENT_ID)) {
    try {
      result = await createGmailProvider().send(fullOpts);
    } catch (err) {
      lastError = err;
      console.error("[email] Gmail fallback also failed:", err);
    }
  }

  if (!result) {
    const errMsg = String(lastError ?? "No email provider configured");
    await writeEmailLog(fullOpts, null, null, "failed", errMsg);
    throw new Error(`[email] All providers failed. Last error: ${errMsg}`);
  }

  await writeEmailLog(fullOpts, result.provider, result.messageId, "sent", null);
  return result;
}
