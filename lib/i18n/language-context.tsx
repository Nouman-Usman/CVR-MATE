"use client";

import { createContext, useContext, useState, useCallback } from "react";
import da from "./da";
import en from "./en";
import type { Dictionary } from "./da";

type Locale = "da" | "en";

interface LanguageContextValue {
  locale: Locale;
  t: Dictionary;
  toggleLocale: () => void;
}

const dictionaries: Record<Locale, Dictionary> = { da, en };

const LanguageContext = createContext<LanguageContextValue>({
  locale: "da",
  t: da,
  toggleLocale: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("da");

  const toggleLocale = useCallback(() => {
    setLocale((prev) => (prev === "da" ? "en" : "da"));
  }, []);

  return (
    <LanguageContext.Provider
      value={{ locale, t: dictionaries[locale], toggleLocale }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
