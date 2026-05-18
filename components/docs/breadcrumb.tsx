"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { DOC_NAV } from "@/lib/docs/nav";

export function DocsBreadcrumb({ slug }: { slug: string }) {
  const { locale, t } = useLanguage();

  const group = DOC_NAV.find((g) => g.items.some((i) => i.slug === slug));
  const item  = group?.items.find((i) => i.slug === slug);

  const groupLabel = group ? ((locale === "da" && group.label.da) ? group.label.da : group.label.en) : "";
  const pageLabel  = item  ? ((locale === "da" && item.title.da)  ? item.title.da  : item.title.en)  : slug;

  return (
    <nav className="flex items-center gap-1 text-[12px] text-slate-400 mb-6" aria-label="breadcrumb">
      <Link href="/docs" className="hover:text-slate-200 transition-colors">{t.docs.breadcrumbHome}</Link>
      {group && (
        <>
          <ChevronRight className="size-3" />
          <span>{groupLabel}</span>
        </>
      )}
      <ChevronRight className="size-3" />
      <span className="text-slate-300">{pageLabel}</span>
    </nav>
  );
}
