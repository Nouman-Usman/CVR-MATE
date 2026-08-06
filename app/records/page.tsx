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
import { useTr } from "@/lib/i18n/tr";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { QueryError, EmptyState } from "@/components/crm/QueryState";
import {
  useRecordsSearch,
  type RecordsSearchMode,
} from "@/lib/hooks/use-records-search";

export default function RecordsPage() {
  const { tr } = useTr();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching, isError, error, refetch } = useRecordsSearch(debounced);

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

        {isError && <QueryError error={error} onRetry={() => refetch()} />}

        {/* Empty state */}
        {!active && (
          <EmptyState
            icon={<Search className="size-6 text-muted-foreground" />}
            title={tr("Skriv mindst 2 tegn for at søge.", "Type at least 2 characters to search.")}
            description={tr(
              "Søg i dine egne records: navn, CVR, e-mail eller telefon.",
              "Search your own records: name, CVR, email or phone."
            )}
          />
        )}

        {active && data && !hasResults && !isFetching && !isError && (
          <EmptyState
            icon={<SearchX className="size-6 text-muted-foreground" />}
            title={tr("Ingen resultater i dine records.", "No results in your records.")}
            description={tr(
              "Prøv virksomhedssøgningen for at finde nye virksomheder.",
              "Try company search to find new companies."
            )}
            action={
              <Link href="/search" className="text-sm font-semibold text-primary hover:underline">
                {tr("Søg i CVR-registret", "Search the CVR registry")}
              </Link>
            }
          />
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
                    <StatusBadge kind="workspace" status={c.status} />
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
