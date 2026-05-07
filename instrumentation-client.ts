// Client-side Sentry initialization (browser).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV,

  tracesSampleRate: isProd ? 0.1 : 1.0,

  sampleRate: 1.0,

  // Capture 10% of all sessions; capture 100% of sessions that contain an error.
  replaysSessionSampleRate: isProd ? 0.1 : 0,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,

  // GDPR: no cookies or IPs forwarded automatically.
  sendDefaultPii: false,

  integrations: [Sentry.replayIntegration()],

  ignoreErrors: [
    "NetworkError",
    "Failed to fetch",
    "Load failed",
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
  ],

  // Drop errors originating from browser extensions — they are never actionable
  beforeSend(event) {
    const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
    const fromExtension = frames.some(
      (f) =>
        f.filename?.startsWith("chrome-extension://") ||
        f.filename?.startsWith("moz-extension://"),
    );
    return fromExtension ? null : event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
