"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "cvr-cookie-consent";

type ConsentStatus = "accepted" | "necessary" | null;

function getStoredConsent(): ConsentStatus {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(CONSENT_KEY);
  if (stored === "accepted" || stored === "necessary") return stored;
  return null;
}

/**
 * GDPR cookie consent banner (Danish platform, Art. 7 GDPR).
 *
 * Session cookies (better-auth.session_token) are strictly necessary and
 * do not require consent. This banner gates any non-essential tracking
 * (e.g. Vercel Analytics) that may be added in the future.
 *
 * Mount once in the root layout. The banner only shows on first visit.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getStoredConsent() === null) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
    // Dispatch event so analytics modules can activate
    window.dispatchEvent(new CustomEvent("cookie-consent", { detail: "accepted" }));
  }

  function necessaryOnly() {
    localStorage.setItem(CONSENT_KEY, "necessary");
    setVisible(false);
    window.dispatchEvent(new CustomEvent("cookie-consent", { detail: "necessary" }));
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg"
    >
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Vi bruger cookies.</span>{" "}
              Nødvendige cookies sikrer at platformen fungerer korrekt. Vi anvender ikke
              sporings- eller markedsføringscookies uden dit samtykke.{" "}
              <a
                href="/privacy"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Læs vores privatlivspolitik
              </a>
              .
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={necessaryOnly}>
              Kun nødvendige
            </Button>
            <Button size="sm" onClick={accept}>
              Acceptér alle
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Read the stored consent preference — use this to gate analytics. */
export function getCookieConsent(): ConsentStatus {
  return getStoredConsent();
}
