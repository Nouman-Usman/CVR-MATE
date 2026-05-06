"use client";

// Gates Vercel Analytics on the user's cookie consent choice.
// Listens for the "cookie-consent" CustomEvent fired by CookieConsent.

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getCookieConsent } from "@/components/cookie-consent";

export function AnalyticsProvider() {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(() => {
    // Initialise from stored consent on mount (SSR-safe default: false)
    if (typeof window === "undefined") return false;
    return getCookieConsent()?.analytics ?? false;
  });

  useEffect(() => {
    function onConsent(e: Event) {
      const detail = (e as CustomEvent<{ analytics: boolean }>).detail;
      setAnalyticsAllowed(detail?.analytics ?? false);
    }
    window.addEventListener("cookie-consent", onConsent);
    return () => window.removeEventListener("cookie-consent", onConsent);
  }, []);

  if (!analyticsAllowed) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
