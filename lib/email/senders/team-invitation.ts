import * as React from "react";
import { sendEmail } from "../mailer";
import { TeamInvitationEmail } from "../templates/team-invitation";

interface SendTeamInvitationEmailArgs {
  to: string;
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
  role: string;
  expiresAt: string; // ISO date string
}

export async function sendTeamInvitationEmail({
  to,
  inviterName,
  organizationName,
  inviteUrl,
  role,
  expiresAt,
}: SendTeamInvitationEmailArgs) {
  return sendEmail(
    React.createElement(TeamInvitationEmail, {
      inviterName,
      organizationName,
      inviteUrl,
      role,
      expiresAt,
    }),
    {
      to,
      subject: `${inviterName} invited you to join ${organizationName} on CVR-MATE`,
      templateId: "team_invitation",
    }
  );
}
