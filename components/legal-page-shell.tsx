"use client";

import Link from "next/link";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoFull } from "@/components/logo";
import { useLanguage } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LegalSection = {
  id: string;
  daTitle: string;
  enTitle: string;
  content: (locale: "da" | "en") => React.ReactNode;
};

type Props = {
  /** Page variant — controls cross-link in header */
  page: "terms" | "privacy" | "data-security";
  daTitle: string;
  enTitle: string;
  daSubtitle: string;
  enSubtitle: string;
  effectiveDate: string;
  sections: LegalSection[];
};

// ─── Shell ────────────────────────────────────────────────────────────────────

export function LegalPageShell({
  page,
  daTitle,
  enTitle,
  daSubtitle,
  enSubtitle,
  effectiveDate,
  sections,
}: Props) {
  const { locale, toggleLocale } = useLanguage();
  const da = locale === "da";

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/">
            <LogoFull size="small" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={page === "terms" ? "/privacy" : page === "privacy" ? "/terms" : "/privacy"}
              className="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {page === "terms"
                ? da ? "Privatlivspolitik →" : "Privacy Policy →"
                : page === "privacy"
                ? da ? "Vilkår & Betingelser →" : "Terms & Conditions →"
                : da ? "Privatlivspolitik →" : "Privacy Policy →"}
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLocale}
              className="gap-1.5 font-bold text-xs"
            >
              <Globe className="size-3.5" />
              {locale === "da" ? "EN" : "DA"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-12 sm:py-16">
        {/* Page header */}
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
            {da ? "Juridiske dokumenter" : "Legal documents"}
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)] mb-4">
            {da ? daTitle : enTitle}
          </h1>
          <p className="text-muted-foreground">
            {da ? "Ikrafttrædelsesdato:" : "Effective date:"}{" "}
            <span className="font-semibold text-foreground">{effectiveDate}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            {da ? daSubtitle : enSubtitle}
          </p>
        </div>

        {/* Table of contents */}
        <nav className="mb-12 rounded-2xl border border-border bg-muted/30 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
            {da ? "Indhold" : "Contents"}
          </p>
          <ol className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-primary hover:underline underline-offset-2 font-medium"
                >
                  {i + 1}. {da ? s.daTitle : s.enTitle}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <div className="space-y-14 text-foreground">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2
                className={cn(
                  "text-xl sm:text-2xl font-extrabold font-[family-name:var(--font-manrope)] text-foreground mb-4",
                )}
              >
                {i + 1}. {da ? s.daTitle : s.enTitle}
              </h2>
              <div className="space-y-4 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2">
                {s.content(locale)}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} CVR-MATE. {da ? "Alle rettigheder forbeholdes." : "All rights reserved."}</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              {da ? "Vilkår" : "Terms"}
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              {da ? "Privatliv" : "Privacy"}
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              {da ? "Log ind" : "Log in"}
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
