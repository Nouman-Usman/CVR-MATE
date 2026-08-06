"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useSyncExternalStore,
} from "react";
import da from "./da";
import en from "./en";
import type { Dictionary } from "./da";

type Locale = "da" | "en";

interface LanguageContextValue {
  locale: Locale;
  t: Dictionary;
  toggleLocale: () => void;
  setLocale: (locale: Locale) => void;
}

const STORAGE_KEY = "cvr-mate-locale";
const LOCALE_EVENT = "cvr-mate-locale-change";
const dictionaries: Record<Locale, Dictionary> = { da, en };

// localStorage is the source of truth for the locale, so it is read through
// useSyncExternalStore instead of an effect that copies it into state. React
// renders getServerSnapshot first and swaps to getSnapshot after hydration,
// which is the same mismatch protection the old effect provided — without the
// extra render pass. Declared at module scope to keep identities stable.
function subscribeToLocale(onChange: () => void) {
  window.addEventListener(LOCALE_EVENT, onChange);
  // `storage` only fires in *other* tabs, so switching language in one tab now
  // updates the rest. The old effect ran once on mount and never resynced.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LOCALE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readLocale(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "da";
  } catch {
    return "da";
  }
}

const localeOnServer = (): Locale => "da";

const LanguageContext = createContext<LanguageContextValue>({
  locale: "da",
  t: da,
  toggleLocale: () => {},
  setLocale: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribeToLocale, readLocale, localeOnServer);

  const setLocale = useCallback((newLocale: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {}
    document.documentElement.lang = newLocale;
    // Write first, then notify: subscribers re-read the store, so the value
    // must already be there when they do.
    window.dispatchEvent(new Event(LOCALE_EVENT));
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "da" ? "en" : "da");
  }, [locale, setLocale]);

  // Sync html lang attribute after locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LanguageContext.Provider
      value={{ locale, t: dictionaries[locale], toggleLocale, setLocale }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
