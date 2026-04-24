import * as React from "react";
import { sendEmail } from "../mailer";
import { WelcomeEmail } from "../templates/welcome";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { eq } from "drizzle-orm";

interface SendWelcomeEmailArgs {
  to: string;
  userName: string;
  userId?: string;
}

export async function sendWelcomeEmail({ to, userName, userId }: SendWelcomeEmailArgs) {
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

  const dashboardUrl = `${process.env.BETTER_AUTH_URL ?? "https://cvr-mate.vercel.app"}/dashboard`;

  return sendEmail(React.createElement(WelcomeEmail, { userName, dashboardUrl, language }), {
    to,
    subject: language === "da"
      ? "Velkommen til CVR-MATE"
      : "Welcome to CVR-MATE",
    templateId: "welcome",
    userId,
  });
}
