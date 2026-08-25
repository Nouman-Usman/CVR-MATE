"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText, Plus, ArrowRight, Inbox } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import RequiresOrganization from "@/components/workspace/requires-organization";
import { useWorkspaces } from "@/lib/hooks/use-workspace";
import { useLanguage } from "@/lib/i18n/language-context";
import { useTr } from "@/lib/i18n/tr";
import { formatOre, formatDate } from "@/lib/format";
import { useQuotes } from "@/lib/hooks/use-quotes";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { ListSkeleton, QueryError, EmptyState } from "@/components/crm/QueryState";
import { statusLabel, statusValues } from "@/lib/crm/status";

export default function QuotesPage() {
  const { locale } = useLanguage();
  const { isPersonal } = useWorkspaces();
  const { tr } = useTr();
  const [status, setStatus] = useState<string | undefined>(undefined);
  // useQuotes has always accepted a status filter; nothing ever passed one.
  const { data, isLoading, isError, error, refetch } = useQuotes(status);
  const quotes = data?.quotes ?? [];

  // This page's data is NOT NULL organization-scoped, so in the personal
  // workspace the API refuses it. Returning here — before any data-dependent
  // branch — is what stops a refusal being rendered as "nothing here yet",
  // which reads as a fact about the business rather than about the workspace.
  if (isPersonal) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <RequiresOrganization feature={tr("Tilbud", "Quotes")} />
        </div>
      </DashboardLayout>
    );
  }

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

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatus(undefined)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              status === undefined
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {tr("Alle", "All")}
          </button>
          {statusValues("quote").map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {statusLabel("quote", s, locale)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} />
        ) : quotes.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6 text-muted-foreground" />}
            title={status ? tr("Ingen tilbud med denne status.", "No quotes with this status.") : tr("Ingen tilbud endnu.", "No quotes yet.")}
            description={tr(
              "Opret et tilbud med linjer, rabat og moms — og send det til kunden.",
              "Build a quote with line items, discounts and VAT — then send it to the customer."
            )}
            action={
              <Link
                href="/quotes/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
              >
                <Plus className="size-4" />
                {tr("Nyt tilbud", "New quote")}
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {typeof data?.total === "number" && data.total > quotes.length && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {tr(
                  `Viser ${quotes.length} af ${data.total} tilbud.`,
                  `Showing ${quotes.length} of ${data.total} quotes.`
                )}
              </p>
            )}
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
                    <StatusBadge kind="quote" status={q.status} />
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
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
