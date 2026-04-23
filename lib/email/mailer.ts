import "server-only";

import { render, toPlainText } from "@react-email/render";
import type { ReactElement } from "react";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import { createResendProvider } from "./providers/resend";
import type { SendEmailOptions, SendEmailResult } from "./types";

async function writeEmailLog(
  opts: SendEmailOptions,
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
      provider: "resend",
      messageId: messageId ?? null,
      status,
      error,
    });
  } catch (logErr) {
    console.error("[email] Failed to write emailLog:", logErr);
  }
}

/**
 * Send transactional email via Resend.
 *
 * @param template  React Email component instance (e.g. <VerificationEmail ... />)
 * @param opts      Recipient, subject, templateId for logging
 */
export async function sendEmail(
  template: ReactElement,
  opts: Omit<SendEmailOptions, "html" | "text">
): Promise<SendEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    const msg = "RESEND_API_KEY not configured";
    await writeEmailLog({ ...opts, html: "", text: "" }, null, "failed", msg);
    throw new Error(`[email] ${msg}`);
  }

  const html = await render(template);
  const text = toPlainText(html);
  const fullOpts: SendEmailOptions = { ...opts, html, text };

  try {
    const result = await createResendProvider().send(fullOpts);
    await writeEmailLog(fullOpts, result.messageId, "sent", null);
    return result;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await writeEmailLog(fullOpts, null, "failed", errMsg);
    throw new Error(`[email] Resend failed: ${errMsg}`);
  }
}
