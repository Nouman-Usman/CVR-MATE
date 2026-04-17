import * as React from "react";
import { sendEmail } from "../mailer";
import { VerificationEmail } from "../templates/verification";

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
  // Rewrite callbackURL so expired/invalid token errors redirect to our
  // dedicated /verify-email page instead of the root URL.
  const urlObj = new URL(verificationUrl);
  urlObj.searchParams.set("callbackURL", "/verify-email");
  const finalUrl = urlObj.toString();

  return sendEmail(
    React.createElement(VerificationEmail, { userName, verificationUrl: finalUrl }),
    {
      to,
      subject: "Verify your CVR-MATE email address",
      templateId: "email_verification",
      userId,
    }
  );
}
