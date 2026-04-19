import * as React from "react";
import { sendEmail } from "../mailer";
import { WeeklySummaryEmail } from "../templates/weekly-summary";
import type { WeeklySummaryData } from "../types";

interface SendWeeklySummaryEmailArgs {
  to: string;
  userName: string;
  userId: string;
  data: WeeklySummaryData;
}

export async function sendWeeklySummaryEmail({
  to,
  userName,
  userId,
  data,
}: SendWeeklySummaryEmailArgs) {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "https://cvr-mate.vercel.app";
  const dashboardUrl = `${baseUrl}/dashboard`;

  return sendEmail(
    React.createElement(WeeklySummaryEmail, { userName, dashboardUrl, data }),
    {
      to,
      subject: `Your CVR-MATE weekly summary: ${data.totalLeads} leads found`,
      templateId: "weekly_summary",
      userId,
    }
  );
}
