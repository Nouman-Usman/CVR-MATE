import * as React from "react";
import { sendEmail } from "../mailer";
import { TeamInvitationEmail } from "../templates/team-invitation";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { eq } from "drizzle-orm";

interface SendTeamInvitationEmailArgs {
  to: string;
  inviterName: string;
  inviterEmail: string;
  recipientName: string;
  organizationName: string;
  inviteUrl: string;
  role: string;
  expiresAt: string; // ISO date string
  inviterId?: string; // Inviter's user ID to get their language preference
}

export async function sendTeamInvitationEmail({
  to,
  inviterName,
  inviterEmail,
  recipientName,
  organizationName,
  inviteUrl,
  role,
  expiresAt,
  inviterId,
}: SendTeamInvitationEmailArgs) {
  // Try to fetch inviter's language preference to send in same language
  let language: "en" | "da" = "en";
  if (inviterId) {
    try {
      const inviterRecord = await db.query.user.findFirst({
        where: eq(user.id, inviterId),
      });
      language = (inviterRecord?.language as "en" | "da") || "en";
    } catch {
      language = "en";
    }
  }

  return sendEmail(
    React.createElement(TeamInvitationEmail, {
      inviterName,
      inviterEmail,
      recipientName,
      organizationName,
      inviteUrl,
      role,
      expiresAt,
      language,
    }),
    {
      to,
      subject:
        language === "da"
          ? `${inviterName} har inviteret dig til ${organizationName} på CVR-MATE`
          : `${inviterName} invited you to join ${organizationName} on CVR-MATE`,
      templateId: "team_invitation",
    }
  );
}
