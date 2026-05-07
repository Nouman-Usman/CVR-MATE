// Server-side Sentry initialization (Node.js runtime).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV,

  // 10% of traces in production to stay within quota; 100% locally for full visibility.
  tracesSampleRate: isProd ? 0.1 : 1.0,

  // Always capture errors regardless of trace sampling.
  sampleRate: 1.0,

  // Include local variable values in stack frames for richer debugging context.
  includeLocalVariables: true,

  enableLogs: true,

  // GDPR: do NOT forward HTTP cookies or IP addresses to Sentry (US servers).
  // User identity is set explicitly via Sentry.setUser({ id }) after authentication.
  sendDefaultPii: false,

  ignoreErrors: [
    "NetworkError",
    "Failed to fetch",
    "Load failed",
    // Next.js throws these as control flow — not real errors
    "NEXT_REDIRECT",
    "NEXT_NOT_FOUND",
  ],

  // Strip residual sensitive headers before the event leaves the server
  beforeSend(event) {
    if (event.request) {
      event.request.cookies = undefined;
      if (event.request.headers && typeof event.request.headers === "object") {
        const h = event.request.headers as Record<string, string>;
        delete h["cookie"];
        delete h["authorization"];
      }
    }
    return event;
  },
});
