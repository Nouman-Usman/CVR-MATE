import "server-only";

import nodemailer from "nodemailer";
import type { EmailProviderClient, SendEmailOptions, SendEmailResult } from "../types";

function createTransport() {
  // Prefer OAuth2 if credentials are present (more secure for production)
  if (process.env.GMAIL_OAUTH2_CLIENT_ID) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.GMAIL_USER!,
        clientId: process.env.GMAIL_OAUTH2_CLIENT_ID!,
        clientSecret: process.env.GMAIL_OAUTH2_CLIENT_SECRET!,
        refreshToken: process.env.GMAIL_OAUTH2_REFRESH_TOKEN!,
      },
    });
  }

  // Fall back to App Password / SMTP (simplest setup for dev)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false, // TLS via STARTTLS on port 587
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

export function createGmailProvider(): EmailProviderClient {
  return {
    async send(opts: SendEmailOptions): Promise<SendEmailResult> {
      const transporter = createTransport();
      const fromName = process.env.EMAIL_FROM_NAME ?? "CVR-MATE";
      // Fall back to SMTP_USER / GMAIL_USER when no dedicated from address is configured
      const fromEmail =
        process.env.EMAIL_FROM_ADDRESS ??
        process.env.SMTP_USER ??
        process.env.GMAIL_USER;
      if (!fromEmail) {
        throw new Error(
          "No from address configured. Set EMAIL_FROM_ADDRESS, SMTP_USER, or GMAIL_USER."
        );
      }

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: Array.isArray(opts.to) ? opts.to.join(", ") : opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
        ...(opts.headers ? { headers: opts.headers } : {}),
      });

      return { provider: "gmail", messageId: info.messageId as string | undefined };
    },
  };
}
