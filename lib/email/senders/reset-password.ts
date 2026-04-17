import * as React from "react";
import { sendEmail } from "../mailer";
import { ResetPasswordEmail } from "../templates/reset-password";

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
  return sendEmail(
    React.createElement(ResetPasswordEmail, { userName, resetUrl }),
    {
      to,
      subject: "Reset your CVR-MATE password",
      templateId: "password_reset",
      userId,
    }
  );
}
