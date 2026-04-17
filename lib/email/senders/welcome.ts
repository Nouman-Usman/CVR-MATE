import * as React from "react";
import { sendEmail } from "../mailer";
import { WelcomeEmail } from "../templates/welcome";

interface SendWelcomeEmailArgs {
  to: string;
  userName: string;
  userId?: string;
}

export async function sendWelcomeEmail({ to, userName, userId }: SendWelcomeEmailArgs) {
  const dashboardUrl = `${process.env.BETTER_AUTH_URL ?? "https://cvr-mate.vercel.app"}/dashboard`;

  return sendEmail(React.createElement(WelcomeEmail, { userName, dashboardUrl }), {
    to,
    subject: "Welcome to CVR-MATE",
    templateId: "welcome",
    userId,
  });
}
