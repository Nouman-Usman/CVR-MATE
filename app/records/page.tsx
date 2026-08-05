"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Building2,
  User,
  Loader2,
  SearchX,
  ArrowRight,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  useRecordsSearch,
  type RecordsSearchMode,
} from "@/lib/hooks/use-records-search";

const STATUS_STYLES: Record<string, string> = {
  prospect: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  lead: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  qualified: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  customer: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  churned: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

export default function RecordsPage() {
  const { locale } = useLanguage();
  const tr = (da: string, en: string) => (locale === "da" ? da : en);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching, error } = useRecordsSearch(debounced);

  const hasResults = !!(data && (data.companies.length || data.contacts.length));
  const active = debounced.length >= 2;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {tr("Mine records", "My records")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tr(
              "Søg i dine egne virksomheder og kontakter — på navn, CVR, e-mail eller telefon.",
              "Search your own companies and contacts — by name, CVR, email, or phone."
            )}
          </p>
        </div>

        {/* Search box */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
          )}
          <Input
            autoFocus
            className="pl-9 h-11"
            placeholder={tr(
              "Søg navn, CVR, e-mail eller telefon…",
              "Search name, CVR, email, or phone…"
            )}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {active && data && (
          <p className="text-xs text-muted-foreground">
            {hasResults
              ? modeLabel(data.mode, tr)
              : tr("Ingen egne records matcher.", "No matching records in your workspace.")}
          </p>
        )}

        {error && (
          <p className="text-sm text-rose-600">{(error as Error).message}</p>
        )}

        {/* Empty state */}
        {!active && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Search className="size-8 opacity-40" />
            <p className="text-sm">
              {tr("Skriv mindst 2 tegn for at søge.", "Type at least 2 characters to search.")}
            </p>
          </div>
        )}

        {active && data && !hasResults && !isFetching && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <SearchX className="size-8 opacity-40" />
            <p className="text-sm">
              {tr("Ingen resultater i dine records.", "No results in your records.")}
            </p>
          </div>
        )}

        {/* Companies */}
        {data && data.companies.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {tr("Virksomheder", "Companies")}
            </h2>
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {data.companies.map((c) => (
                <Link
                  key={c.vat}
                  href={`/company/${c.vat}`}
                  className="group flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                >
                  <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      CVR {c.vat}
                      {c.city ? ` · ${c.city}` : ""}
                    </p>
                  </div>
                  {c.status ? (
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        STATUS_STYLES[c.status] ?? STATUS_STYLES.prospect
                      }`}
                    >
                      {c.status}
                    </span>
                  ) : c.saved ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      {tr("Gemt", "Saved")}
                    </span>
                  ) : null}
                  <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Contacts */}
        {data && data.contacts.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {tr("Kontakter", "Contacts")}
            </h2>
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {data.contacts.map((c) => (
                <Link
                  key={c.id}
                  href={`/company/${c.companyVat}`}
                  className="group flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                >
                  <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <User className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {c.name}
                      {c.title ? (
                        <span className="text-muted-foreground font-normal"> · {c.title}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{c.companyName}</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

function modeLabel(
  mode: RecordsSearchMode | undefined,
  tr: (da: string, en: string) => string
): string {
  switch (mode) {
    case "email":
      return tr("Nøjagtig e-mail-match", "Exact email match");
    case "phone":
      return tr("Nøjagtig telefon-match", "Exact phone match");
    case "cvr":
      return tr("CVR- og telefon-match", "CVR & phone match");
    case "name":
      return tr("Navnesøgning", "Name search");
    default:
      return "";
  }
}
