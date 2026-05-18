"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useLanguage } from "@/lib/i18n/language-context";
import { DOC_NAV } from "@/lib/docs/nav";
import { DocsSearchInput } from "./search-input";

export function DocsHeader() {
  const pathname = usePathname();
  const { locale, t, toggleLocale } = useLanguage();
  const [open, setOpen] = useState(false);

  const currentPage = DOC_NAV.flatMap((g) => g.items).find((i) => `/docs/${i.slug}` === pathname);
  const pageTitle = currentPage
    ? ((locale === "da" && currentPage.title.da) ? currentPage.title.da : currentPage.title.en)
    : "Docs";

  return (
    <header className="sticky top-0 z-30 h-14 bg-background/95 backdrop-blur border-b border-border flex items-center justify-between px-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="p-1.5 text-muted-foreground hover:text-foreground">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </SheetTrigger>
        <SheetContent side="left" className="w-[260px] p-0 bg-[#0f172a] border-white/[0.06]">
          <div className="flex items-center gap-2 px-5 h-14 border-b border-white/[0.06]">
            <Link href="/" onClick={() => setOpen(false)} className="text-white font-bold text-base tracking-tight font-[family-name:var(--font-manrope)]">
              CVR-MATE
            </Link>
            <span className="ml-1 text-[10px] font-semibold text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">Docs</span>
          </div>
          <div className="pt-3">
            <DocsSearchInput />
          </div>
          <nav className="px-3 pb-4">
            {DOC_NAV.map((group) => {
              const groupLabel = (locale === "da" && group.label.da) ? group.label.da : group.label.en;
              return (
                <div key={groupLabel} className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 px-2 mb-1.5">{groupLabel}</p>
                  {group.items.map((item) => {
                    const title = (locale === "da" && item.title.da) ? item.title.da : item.title.en;
                    const href = `/docs/${item.slug}`;
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={item.slug}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={`block px-2 py-1.5 rounded-md text-[13px] transition-colors mb-0.5 ${
                          isActive ? "bg-white/[0.08] text-white font-medium" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {title}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <div className="px-3 pb-4 pt-2 border-t border-white/[0.06] space-y-1">
            <button onClick={toggleLocale} className="w-full text-left px-2 py-1.5 text-[12px] text-slate-400 hover:text-slate-200 rounded-md">
              {locale === "da" ? "🇬🇧 English" : "🇩🇰 Dansk"}
            </button>
            <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-slate-400 hover:text-slate-200 rounded-md">
              {t.docs.backToApp} <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      <span className="text-sm font-medium text-foreground">{pageTitle}</span>
      <div className="w-9" />
    </header>
  );
}
