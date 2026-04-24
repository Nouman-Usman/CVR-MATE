import * as React from "react";
import { sendEmail } from "../mailer";
import { DailyLeadUpdateEmail } from "../templates/daily-lead-update";
import type { DailyLeadUpdateData } from "../types";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { eq } from "drizzle-orm";

interface SendDailyLeadUpdateEmailArgs {
  to: string;
  userName: string;
  userId: string;
  data: DailyLeadUpdateData;
  language?: "en" | "da";
}

export async function sendDailyLeadUpdateEmail({
  to,
  userName,
  userId,
  data,
  language,
}: SendDailyLeadUpdateEmailArgs) {
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
  const triggersUrl = `${baseUrl}/triggers`;

  return sendEmail(
    React.createElement(DailyLeadUpdateEmail, { userName, baseUrl, triggersUrl, data, language: finalLanguage }),
    {
      to,
      subject: finalLanguage === "da"
        ? `${data.matchCount} nye ${data.matchCount === 1 ? "match" : "matches"} for "${data.triggerName}"`
        : `${data.matchCount} new ${data.matchCount === 1 ? "match" : "matches"} for "${data.triggerName}"`,
      templateId: "daily_lead_update",
      userId,
    }
  );
}
