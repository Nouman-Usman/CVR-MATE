import * as React from "react";
import { sendEmail } from "../mailer";
import { WeeklySummaryEmail } from "../templates/weekly-summary";
import type { WeeklySummaryData } from "../types";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { eq } from "drizzle-orm";

interface SendWeeklySummaryEmailArgs {
  to: string;
  userName: string;
  userId: string;
  data: WeeklySummaryData;
  language?: "en" | "da";
}

export async function sendWeeklySummaryEmail({
  to,
  userName,
  userId,
  data,
  language,
}: SendWeeklySummaryEmailArgs) {
  // Use provided language or fetch from DB
  let finalLanguage: "en" | "da" = language || "en";
  if (!language) {
    try {
      const userRecord = await db.query.user.findFirst({
        where: eq(user.id, userId),
      });
      finalLanguage = (userRecord?.language as "en" | "da") || "en";
    } catch {
      finalLanguage = "en";
    }
  }

  const baseUrl = process.env.BETTER_AUTH_URL ?? "https://cvr-mate.vercel.app";
  const dashboardUrl = `${baseUrl}/dashboard`;

  return sendEmail(
    React.createElement(WeeklySummaryEmail, { userName, dashboardUrl, data, language: finalLanguage }),
    {
      to,
      subject: finalLanguage === "da"
        ? `Din CVR-MATE ugentlige sammenfatning: ${data.totalLeads} leads fundet`
        : `Your CVR-MATE weekly summary: ${data.totalLeads} leads found`,
      templateId: "weekly_summary",
      userId,
    }
  );
}
