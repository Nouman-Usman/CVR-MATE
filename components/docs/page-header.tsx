"use client";

import { useLanguage } from "@/lib/i18n/language-context";
import type { DocPage } from "@/lib/docs/types";

export function DocsPageHeader({ doc }: { doc: DocPage }) {
  const { locale } = useLanguage();
  const title = (locale === "da" && doc.title.da) ? doc.title.da : doc.title.en;
  const desc  = (locale === "da" && doc.description.da) ? doc.description.da : doc.description.en;

  return (
    <header className="mb-8 pb-6 border-b border-border">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)] mb-2">
        {title}
      </h1>
      <p className="text-[15px] text-slate-500 leading-6">{desc}</p>
    </header>
  );
}
