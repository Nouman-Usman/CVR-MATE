import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins/organization";
import { db } from "@/db";

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
    }),
  ],
});
