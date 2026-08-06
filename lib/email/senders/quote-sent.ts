import "server-only";

import * as React from "react";
import { eq } from "drizzle-orm";
import { sendEmail } from "../mailer";
import { QuoteSentEmail } from "../templates/quote-sent";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { formatOre } from "@/lib/format";

interface SendQuoteEmailArgs {
  to: string;
  sellerName: string;
  customerName: string;
  quoteNumber: string;
  totalOre: number;
  validUntil: string | null;
  quoteUrl: string;
  message: string | null;
  /** The sending user — used for their language preference and as reply-to. */
  senderId: string;
  senderEmail?: string | null;
}

/**
 * Email a quote to an external customer.
 *
 * Unlike every other sender here, the recipient is not a platform user, so this
 * never consults notification preferences (those govern *our* emails to *our*
 * users) and logs with a null userId. Language follows the sender, since that is
 * the only signal available about the relationship.
 */
export async function sendQuoteEmail({
  to,
  sellerName,
  customerName,
  quoteNumber,
  totalOre,
  validUntil,
  quoteUrl,
  message,
  senderId,
  senderEmail,
}: SendQuoteEmailArgs) {
  let language: "da" | "en" = "da";
  try {
    const sender = await db.query.user.findFirst({ where: eq(user.id, senderId) });
    language = (sender?.language as "da" | "en") || "da";
  } catch {
    language = "da";
  }

  const subject =
    language === "da"
      ? `Tilbud ${quoteNumber} fra ${sellerName}`
      : `Quote ${quoteNumber} from ${sellerName}`;

  return sendEmail(
    React.createElement(QuoteSentEmail, {
      language,
      sellerName,
      customerName,
      quoteNumber,
      totalFormatted: formatOre(totalOre, language),
      validUntil,
      quoteUrl,
      message,
    }),
    {
      to,
      subject,
      templateId: "quote_sent",
      // Replies belong with the person who sent the quote, not the platform.
      replyTo: senderEmail ?? undefined,
    }
  );
}
