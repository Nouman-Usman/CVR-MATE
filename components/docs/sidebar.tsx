"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { DOC_NAV } from "@/lib/docs/nav";
import { DocsSearchInput } from "./search-input";

export function DocsSidebar() {
  const pathname = usePathname();
  const { locale, t, toggleLocale } = useLanguage();

  return (
    <aside className="hidden md:flex flex-col w-[260px] shrink-0 sticky top-0 h-screen overflow-y-auto bg-[#0f172a] border-r border-white/[0.06]">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 h-14 border-b border-white/[0.06] shrink-0">
        <Link href="/" className="text-white font-bold text-base tracking-tight font-[family-name:var(--font-manrope)]">
          CVR-MATE
        </Link>
        <span className="ml-1 text-[10px] font-semibold text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">
          Docs
        </span>
      </div>

      {/* Search */}
      <div className="pt-3">
        <DocsSearchInput />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-4 overflow-y-auto">
        {DOC_NAV.map((group) => {
          const groupLabel = (locale === "da" && group.label.da) ? group.label.da : group.label.en;
          return (
            <div key={groupLabel} className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 px-2 mb-1.5">
                {groupLabel}
              </p>
              {group.items.map((item) => {
                const title = (locale === "da" && item.title.da) ? item.title.da : item.title.en;
                const href = `/docs/${item.slug}`;
                const isActive = pathname === href;
                return (
                  <Link
                    key={item.slug}
                    href={href}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors mb-0.5 ${
                      isActive
                        ? "bg-white/[0.08] text-white font-medium"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-3 w-[3px] h-4 rounded-full bg-gradient-to-b from-blue-400 to-cyan-400" />
                    )}
                    {title}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-2 border-t border-white/[0.06] space-y-1 shrink-0">
        <button
          onClick={toggleLocale}
          className="w-full text-left px-2 py-1.5 text-[12px] text-slate-400 hover:text-slate-200 transition-colors rounded-md hover:bg-white/[0.04]"
        >
          {locale === "da" ? "🇬🇧 English" : "🇩🇰 Dansk"}
        </button>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-slate-400 hover:text-slate-200 transition-colors rounded-md hover:bg-white/[0.04]"
        >
          {t.docs.backToApp}
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </aside>
  );
}
