"use client";

import { useCallback } from "react";
import { useLanguage } from "./language-context";
import { ApiError } from "@/lib/api/fetch-json";

/**
 * Inline two-language helper, for copy that is genuinely one-off.
 *
 * Eleven CRM pages each declared their own private copy of this. Reusable,
 * user-facing strings still belong in the `da.ts`/`en.ts` dictionary (`t.saved`,
 * `t.todos`); this exists so one-off labels do not each invent their own helper.
 */
export type Translate = (da: string, en: string) => string;

export function useTr(): { tr: Translate; locale: "da" | "en" } {
  const { locale } = useLanguage();
  const tr = useCallback<Translate>((da, en) => (locale === "da" ? da : en), [locale]);
  return { tr, locale };
}

/**
 * Turn a thrown error into something a Danish user should read.
 *
 * API routes throw English text ("Only a draft quote can be sent."). Translating
 * at the throw site would mean the server guessing the reader's locale, so the
 * server sends a stable message plus a status and the client localizes here —
 * falling back to the server's own text for cases not worth enumerating.
 */
export function useApiErrorMessage(): (err: unknown) => string {
  const { tr } = useTr();

  return useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError) {
        if (err.isRateLimited) {
          return tr("For mange forsøg. Prøv igen om lidt.", "Too many attempts. Try again shortly.");
        }
        if (err.isUpgradeRequired) {
          return tr(
            "Din plan giver ikke adgang til denne funktion.",
            "Your plan does not include this feature."
          );
        }
        if (err.isConflict) {
          // The server's conflict text names the specific illegal transition,
          // which is more useful than a generic "conflict".
          return err.message;
        }
        if (err.status >= 500) {
          return tr("Noget gik galt. Prøv igen.", "Something went wrong. Please try again.");
        }
        return err.message;
      }
      if (err instanceof Error && err.message) return err.message;
      return tr("Ukendt fejl", "Unknown error");
    },
    [tr]
  );
}
