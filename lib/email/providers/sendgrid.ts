import "server-only";

import sgMail from "@sendgrid/mail";
import type { EmailProviderClient, SendEmailOptions, SendEmailResult } from "../types";

export function createSendGridProvider(): EmailProviderClient {
  return {
    async send(opts: SendEmailOptions): Promise<SendEmailResult> {
      const key = process.env.SENDGRID_API_KEY;
      if (!key) throw new Error("SENDGRID_API_KEY is not configured");

      sgMail.setApiKey(key);

      const [response] = await sgMail.send({
        to: opts.to,
        from: {
          email: process.env.EMAIL_FROM_ADDRESS!,
          name: process.env.EMAIL_FROM_NAME ?? "CVR-MATE",
        },
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
        ...(opts.headers ? { headers: opts.headers } : {}),
      });

      const rawId = response.headers["x-message-id"];
      const messageId = Array.isArray(rawId) ? rawId[0] : (rawId as string | undefined);

      return { provider: "sendgrid", messageId };
    },
  };
}
