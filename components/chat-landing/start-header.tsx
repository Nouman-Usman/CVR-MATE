"use client";

import { Globe } from "lucide-react";
import { LogoFull } from "@/components/logo";
import { useLanguage } from "@/lib/i18n/language-context";

/* Header for the chat funnel: brand, a live-registry pulse, and the language
   toggle so a Danish or English visitor can converse in their own language. */
export function StartHeader() {
  const { t, locale, toggleLocale } = useLanguage();

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/6 bg-[#0a0f1e]/80 px-4 backdrop-blur-2xl sm:px-6">
      <LogoFull size="small" variant="dark" />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="hidden sm:inline">{t.chat.live}</span>
          <span className="sm:hidden">{t.chat.liveShort}</span>
        </div>

        <button
          type="button"
          onClick={toggleLocale}
          aria-label={t.chat.toggleAria}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        >
          <Globe className="size-3.5" />
          {locale === "da" ? "EN" : "DA"}
        </button>
      </div>
    </header>
  );
}
