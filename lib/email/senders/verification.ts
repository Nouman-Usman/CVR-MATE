import * as React from "react";
import { sendEmail } from "../mailer";
import { VerificationEmail } from "../templates/verification";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { eq } from "drizzle-orm";

interface SendVerificationEmailArgs {
  to: string;
  userName: string;
  verificationUrl: string;
  userId?: string;
}

export async function sendVerificationEmail({
  to,
  userName,
  verificationUrl,
  userId,
}: SendVerificationEmailArgs) {
  // Fetch user's language preference
  let language: "en" | "da" = "en";
  if (userId) {
    try {
      const userRecord = await db.query.user.findFirst({
        where: eq(user.id, userId),
      });
      language = (userRecord?.language as "en" | "da") || "en";
    } catch {
      // Default to English if fetch fails
      language = "en";
    }
  }

  // Rewrite callbackURL so expired/invalid token errors redirect to our
  // dedicated /verify-email page instead of the root URL.
  const urlObj = new URL(verificationUrl);
  urlObj.searchParams.set("callbackURL", "/verify-email");
  const finalUrl = urlObj.toString();

  return sendEmail(
    React.createElement(VerificationEmail, { userName, verificationUrl: finalUrl, language }),
    {
      to,
      subject: language === "da"
        ? "Bekræft din CVR-MATE e-mail-adresse"
        : "Verify your CVR-MATE email address",
      templateId: "email_verification",
      userId,
    }
  );
}
