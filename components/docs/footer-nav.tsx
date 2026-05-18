"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { DOC_NAV, ALL_DOC_SLUGS } from "@/lib/docs/nav";

function getTitle(slug: string, locale: string): string {
  for (const group of DOC_NAV) {
    const item = group.items.find((i) => i.slug === slug);
    if (item) return (locale === "da" && item.title.da) ? item.title.da : item.title.en;
  }
  return slug;
}

export function DocsFooterNav({ currentSlug }: { currentSlug: string }) {
  const { locale, t } = useLanguage();
  const idx  = ALL_DOC_SLUGS.indexOf(currentSlug);
  const prev = idx > 0                          ? ALL_DOC_SLUGS[idx - 1] : null;
  const next = idx < ALL_DOC_SLUGS.length - 1  ? ALL_DOC_SLUGS[idx + 1] : null;

  return (
    <div className="flex items-center justify-between border-t border-border pt-8 mt-12">
      {prev ? (
        <Link
          href={`/docs/${prev}`}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>
            <span className="block text-[10px] uppercase tracking-widest text-slate-400">{t.docs.prevPage}</span>
            {getTitle(prev, locale)}
          </span>
        </Link>
      ) : <div />}

      {next ? (
        <Link
          href={`/docs/${next}`}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-foreground transition-colors text-right"
        >
          <span>
            <span className="block text-[10px] uppercase tracking-widest text-slate-400">{t.docs.nextPage}</span>
            {getTitle(next, locale)}
          </span>
          <ArrowRight className="size-4" />
        </Link>
      ) : <div />}
    </div>
  );
}
