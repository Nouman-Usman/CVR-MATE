"use client";

// Gates Vercel Analytics on the user's cookie consent choice.
// Listens for the "cookie-consent" CustomEvent fired by CookieConsent.

import { useSyncExternalStore } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getCookieConsent } from "@/components/cookie-consent";

// The consent cookie is an external store, so it is read through
// useSyncExternalStore rather than an effect-plus-setState. That also collapses
// the two effects into one subscription: the initial read and the change
// notification were previously separate code paths that could disagree.
// Module-level so the identities stay stable across renders.
function subscribeToConsent(onChange: () => void) {
  window.addEventListener("cookie-consent", onChange);
  return () => window.removeEventListener("cookie-consent", onChange);
}

const readAnalyticsConsent = () => getCookieConsent()?.analytics ?? false;

/** No cookie on the server — never render analytics into the SSR output. */
const consentOnServer = () => false;

export function AnalyticsProvider() {
  const analyticsAllowed = useSyncExternalStore(
    subscribeToConsent,
    readAnalyticsConsent,
    consentOnServer
  );

  if (!analyticsAllowed) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
