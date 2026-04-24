import * as React from "react";
import { sendEmail } from "../mailer";
import { ResetPasswordEmail } from "../templates/reset-password";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { eq } from "drizzle-orm";

interface SendResetPasswordEmailArgs {
  to: string;
  userName: string;
  resetUrl: string;
  userId?: string;
}

export async function sendResetPasswordEmail({
  to,
  userName,
  resetUrl,
  userId,
}: SendResetPasswordEmailArgs) {
  // Fetch user's language preference
  let language: "en" | "da" = "en";
  if (userId) {
    try {
      const userRecord = await db.query.user.findFirst({
        where: eq(user.id, userId),
      });
      language = (userRecord?.language as "en" | "da") || "en";
    } catch {
      language = "en";
    }
  }

  return sendEmail(
    React.createElement(ResetPasswordEmail, { userName, resetUrl, language }),
    {
      to,
      subject: language === "da"
        ? "Nulstil din CVR-MATE-adgangskode"
        : "Reset your CVR-MATE password",
      templateId: "password_reset",
      userId,
    }
  );
}
