// Edge runtime Sentry initialization (middleware, edge routes).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV,

  tracesSampleRate: isProd ? 0.1 : 1.0,

  sampleRate: 1.0,

  enableLogs: true,

  // GDPR: no cookies or IPs forwarded automatically.
  sendDefaultPii: false,

  ignoreErrors: [
    "NetworkError",
    "Failed to fetch",
    "Load failed",
    "NEXT_REDIRECT",
    "NEXT_NOT_FOUND",
  ],
});
