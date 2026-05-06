"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const CONSENT_KEY = "cvr-cookie-consent";

type ConsentPreferences = {
  necessary: true;
  analytics: boolean;
};

type StoredConsent = {
  version: 1;
  preferences: ConsentPreferences;
  timestamp: number;
};

function getStoredConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveConsent(preferences: ConsentPreferences) {
  const stored: StoredConsent = { version: 1, preferences, timestamp: Date.now() };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(stored));
  window.dispatchEvent(new CustomEvent("cookie-consent", { detail: preferences }));
}

type View = "banner" | "preferences";

/**
 * GDPR cookie consent (Art. 7 GDPR, Danish platform).
 * Session cookies (better-auth.session_token) are strictly necessary and exempt.
 * Mount once in the root layout.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [view, setView] = useState<View>("banner");
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    if (getStoredConsent() === null) {
      // Small delay so the page loads first — avoids layout shift on first paint
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  function acceptAll() {
    saveConsent({ necessary: true, analytics: true });
    setVisible(false);
  }

  function acceptNecessary() {
    saveConsent({ necessary: true, analytics: false });
    setVisible(false);
  }

  function savePreferences() {
    saveConsent({ necessary: true, analytics });
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      {/* Backdrop on mobile when preferences open */}
      {view === "preferences" && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] md:hidden animate-fade-in"
          onClick={acceptNecessary}
          aria-hidden="true"
        />
      )}

      <div
        role="dialog"
        aria-modal="false"
        aria-label="Cookie-indstillinger"
        className={cn(
          // Base positioning — full-width bottom sheet on mobile, floating card on desktop
          "fixed z-50 animate-fade-in-up",
          // Mobile: full-width bottom sheet
          "bottom-0 left-0 right-0",
          // Desktop: floating card bottom-left
          "md:bottom-6 md:left-6 md:right-auto md:max-w-[420px]",
          // Shape
          "rounded-t-2xl md:rounded-2xl",
          // Surface
          "bg-card border border-border shadow-2xl shadow-black/10",
          // Ensure no overflow on small screens
          "max-h-[90dvh] overflow-y-auto overscroll-contain",
        )}
      >
        {/* Header bar — always visible */}
        <div className="flex items-start gap-3 p-5 pb-0">
          {/* Cookie icon */}
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary mt-0.5">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
              <path d="M8.5 8.5v.01" />
              <path d="M16 15.5v.01" />
              <path d="M12 12v.01" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug">
              Vi bruger cookies
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              {view === "banner"
                ? "Vi anvender nødvendige cookies til at sikre platformens funktionalitet. Med dit samtykke aktiveres analyseværktøjer."
                : "Vælg hvilke cookies du ønsker at tillade. Nødvendige cookies kan ikke fravælges."}
            </p>
          </div>

          {/* Close / reject all — keyboard accessible */}
          <button
            onClick={acceptNecessary}
            className="shrink-0 -mt-1 -mr-1 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Luk og accepter kun nødvendige cookies"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Preferences panel — expanded view */}
        {view === "preferences" && (
          <div className="animate-slide-down px-5 pt-4 space-y-3">
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {/* Necessary — locked */}
              <CookieCategory
                title="Nødvendige"
                description="Login-session, CSRF-beskyttelse og sikkerhed. Kræves for at platformen fungerer."
                enabled={true}
                locked
              />

              {/* Analytics */}
              <CookieCategory
                title="Analyse"
                description="Anonymiserede besøgsstatistikker via Vercel Analytics. Hjælper os med at forbedre platformen."
                enabled={analytics}
                onToggle={setAnalytics}
              />
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Du kan til enhver tid ændre dine præferencer under{" "}
              <span className="font-medium text-foreground">Indstillinger → Privatliv</span>.{" "}
              <a
                href="/privacy"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privatlivspolitik
              </a>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="p-5 pt-4 space-y-2">
          {view === "banner" ? (
            <>
              <Button className="w-full" size="sm" onClick={acceptAll}>
                Acceptér alle cookies
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="w-full" onClick={acceptNecessary}>
                  Kun nødvendige
                </Button>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setView("preferences")}>
                  Tilpas valg
                </Button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="w-full" onClick={() => setView("banner")}>
                Tilbage
              </Button>
              <Button size="sm" className="w-full" onClick={savePreferences}>
                Gem præferencer
              </Button>
            </div>
          )}
        </div>

        {/* Safe-area spacer for iOS home bar */}
        <div className="h-[env(safe-area-inset-bottom,0px)] md:hidden" />
      </div>
    </>
  );
}

// ─── Category row ─────────────────────────────────────────────────────────────

type CookieCategoryProps = {
  title: string;
  description: string;
  enabled: boolean;
  locked?: boolean;
  onToggle?: (value: boolean) => void;
};

function CookieCategory({ title, description, enabled, locked, onToggle }: CookieCategoryProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          {locked && (
            <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Altid aktiv
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <div className="shrink-0 pt-0.5">
        {locked ? (
          <Switch size="sm" checked disabled aria-label={`${title} — altid aktiv`} />
        ) : (
          <Switch
            size="sm"
            checked={enabled}
            onCheckedChange={onToggle}
            aria-label={`Aktiver ${title.toLowerCase()} cookies`}
          />
        )}
      </div>
    </div>
  );
}

/** Read stored consent preferences — use to gate analytics activation. */
export function getCookieConsent(): ConsentPreferences | null {
  const stored = getStoredConsent();
  return stored?.preferences ?? null;
}
