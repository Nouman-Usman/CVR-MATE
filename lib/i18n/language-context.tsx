"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
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
const dictionaries: Record<Locale, Dictionary> = { da, en };

function getSavedLocale(): Locale {
  if (typeof window === "undefined") return "da";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "da" || saved === "en") return saved;
  } catch {}
  return "da";
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: "da",
  t: da,
  toggleLocale: () => {},
  setLocale: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getSavedLocale);
  const [hydrated, setHydrated] = useState(false);

  // Mark hydrated after first client render
  useEffect(() => {
    setHydrated(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {}
    document.documentElement.lang = newLocale;
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "da" ? "en" : "da");
  }, [locale, setLocale]);

  // Sync html lang attribute
  useEffect(() => {
    if (hydrated) {
      document.documentElement.lang = locale;
    }
  }, [locale, hydrated]);

  // Prevent flash of wrong language — render nothing until hydrated
  if (!hydrated) {
    return null;
  }

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
