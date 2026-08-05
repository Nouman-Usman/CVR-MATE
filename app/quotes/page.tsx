"use client";

import Link from "next/link";
import { FileText, Plus, ArrowRight, Inbox } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatOre, formatDate } from "@/lib/format";
import { useQuotes } from "@/lib/hooks/use-quotes";

export const QUOTE_STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  expired: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  converted: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

export default function QuotesPage() {
  const { locale } = useLanguage();
  const tr = (da: string, en: string) => (locale === "da" ? da : en);
  const { data, isLoading } = useQuotes();
  const quotes = data?.quotes ?? [];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{tr("Tilbud", "Quotes")}</h1>
              <p className="text-sm text-muted-foreground">
                {tr("Kommercielle tilbud til dine kunder.", "Commercial quotes for your customers.")}
              </p>
            </div>
          </div>
          <Link
            href="/quotes/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 shrink-0"
          >
            <Plus className="size-4" />
            {tr("Nyt tilbud", "New quote")}
          </Link>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-12 text-center">{tr("Indlæser…", "Loading…")}</p>
        ) : quotes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Inbox className="size-8 opacity-40" />
            <p className="text-sm">{tr("Ingen tilbud endnu.", "No quotes yet.")}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {quotes.map((q) => (
              <Link
                key={q.id}
                href={`/quotes/${q.id}`}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{q.number}</span>
                    <span
                      className={
                        "text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full " +
                        (QUOTE_STATUS_STYLE[q.status] ?? QUOTE_STATUS_STYLE.draft)
                      }
                    >
                      {q.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {q.companyName || `CVR ${q.companyVat}`}
                    {q.issueDate ? ` · ${formatDate(q.issueDate, locale)}` : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                  {formatOre(q.total, locale)}
                </span>
                <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
