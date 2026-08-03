import * as React from "react";
import { sendEmail } from "../mailer";
import { MatchFeedReadyEmail } from "../templates/match-feed-ready";
import type { MatchFeedReadyData } from "../types";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { eq } from "drizzle-orm";

interface SendMatchFeedReadyEmailArgs {
  to: string;
  userName: string;
  userId: string;
  data: MatchFeedReadyData;
  language?: "en" | "da";
}

export async function sendMatchFeedReadyEmail({
  to,
  userName,
  userId,
  data,
  language,
}: SendMatchFeedReadyEmailArgs) {
  // Use provided language or fetch from DB (mirrors sendDailyLeadUpdateEmail).
  let finalLanguage: "en" | "da" = language || "da";
  if (!language) {
    try {
      const userRecord = await db.query.user.findFirst({
        where: eq(user.id, userId),
      });
      finalLanguage = (userRecord?.language as "en" | "da") || "da";
    } catch {
      finalLanguage = "da";
    }
  }

  const baseUrl = process.env.BETTER_AUTH_URL ?? "https://cvr-mate.dk";
  const matchesUrl = `${baseUrl}/matches`;
  const n = data.matchCount;
  const matchWord = n === 1 ? "match" : "matches";

  return sendEmail(
    React.createElement(MatchFeedReadyEmail, {
      userName,
      baseUrl,
      matchesUrl,
      data,
      language: finalLanguage,
    }),
    {
      to,
      subject:
        finalLanguage === "da"
          ? `${n} nye ${matchWord} klar til dig`
          : `${n} new ${matchWord} ready for you`,
      templateId: "match_feed",
      userId,
    }
  );
}
