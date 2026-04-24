import "server-only";

import { Resend } from "resend";
import type { EmailProviderClient, SendEmailOptions, SendEmailResult } from "../types";

export function createResendProvider(): EmailProviderClient {
  return {
    async send(opts: SendEmailOptions): Promise<SendEmailResult> {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error("RESEND_API_KEY is not configured");

      const resend = new Resend(key);

      const fromName = process.env.EMAIL_FROM_NAME ?? "CVR-MATE";
      const fromEmail = process.env.EMAIL_FROM_ADDRESS;
      if (!fromEmail) {
        throw new Error("EMAIL_FROM_ADDRESS is not configured");
      }

      const { data, error } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
        ...(opts.headers ? { headers: opts.headers } : {}),
      });

      if (error) {
        throw new Error(`Resend error: ${error.message}`);
      }

      return { provider: "resend", messageId: data?.id };
    },
  };
}
