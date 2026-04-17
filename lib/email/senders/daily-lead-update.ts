import * as React from "react";
import { sendEmail } from "../mailer";
import { DailyLeadUpdateEmail } from "../templates/daily-lead-update";
import type { DailyLeadUpdateData } from "../types";

interface SendDailyLeadUpdateEmailArgs {
  to: string;
  userName: string;
  userId: string;
  data: DailyLeadUpdateData;
}

export async function sendDailyLeadUpdateEmail({
  to,
  userName,
  userId,
  data,
}: SendDailyLeadUpdateEmailArgs) {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "https://cvr-mate.vercel.app";
  const triggersUrl = `${baseUrl}/triggers`;

  return sendEmail(
    React.createElement(DailyLeadUpdateEmail, { userName, baseUrl, triggersUrl, data }),
    {
      to,
      subject: `${data.matchCount} new ${data.matchCount === 1 ? "match" : "matches"} for "${data.triggerName}"`,
      templateId: "daily_lead_update",
      userId,
    }
  );
}
