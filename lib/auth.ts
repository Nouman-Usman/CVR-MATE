import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins/organization";
import { db } from "@/db";
import { sendVerificationEmail } from "@/lib/email/senders/verification";
import { sendResetPasswordEmail } from "@/lib/email/senders/reset-password";
import { sendWelcomeEmail } from "@/lib/email/senders/welcome";
import { sendTeamInvitationEmail } from "@/lib/email/senders/team-invitation";

// In production on Vercel, VERCEL_URL is auto-set (e.g. "my-app.vercel.app")
// BETTER_AUTH_URL must be the canonical production URL with https://
const resolvedBaseURL =
  process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
  "https://cvr-mate.vercel.app"; // Hardcode production URL to avoid Vercel branch domain issues

export const auth = betterAuth({
  baseURL: resolvedBaseURL,
  trustedOrigins: [
    "https://cvr-mate.vercel.app",
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
    "http://localhost:3000",
  ].filter(Boolean),
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    // Block login until email is verified; Better Auth auto-resends the
    // verification email on the blocked attempt (sendOnSignIn: true below).
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail({
        to: user.email,
        userName: user.name,
        resetUrl: url,
        userId: user.id,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({
        to: user.email,
        userName: user.name,
        verificationUrl: url,
        userId: user.id,
      });
    },
    sendOnSignUp: true,
    // Re-send verification email automatically when unverified user tries to sign in
    sendOnSignIn: true,
    // Auto-create session immediately after the user clicks the verify link
    autoSignInAfterVerification: true,
    // Token validity: 24 hours
    expiresIn: 86400,
    // Send welcome email only after the user has verified their email address.
    // This hook fires for email/password users; Google OAuth users are handled
    // in databaseHooks below (their emailVerified is true at creation time).
    afterEmailVerification: async (user: { id: string; email: string; name: string }) => {
      sendWelcomeEmail({
        to: user.email,
        userName: user.name,
        userId: user.id,
      }).catch((err) => console.error("[email] Welcome email failed:", err));
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user: { id: string; email: string; name: string; emailVerified: boolean }) => {
          // Only send welcome email on creation for social-provider users (Google etc.)
          // whose email is already verified at account creation time.
          // Email/password users get their welcome email via afterEmailVerification above.
          if (user.emailVerified) {
            sendWelcomeEmail({
              to: user.email,
              userName: user.name,
              userId: user.id,
            }).catch((err) => console.error("[email] Welcome email failed:", err));
          }
        },
      },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      sendInvitationEmail: async ({ inviter, organization: org, invitation }) => {
        await sendTeamInvitationEmail({
          to: invitation.email,
          inviterName: inviter.user.name,
          organizationName: org.name,
          inviteUrl: `${resolvedBaseURL}/api/auth/organization/accept-invitation/${invitation.id}`,
          role: invitation.role,
          expiresAt: invitation.expiresAt.toISOString(),
        });
      },
    }),
  ],
});
