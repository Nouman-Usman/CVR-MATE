"use client";

import Link from "next/link";
import {
  Users,
  MapPin,
  Phone,
  Mail,
  StickyNote,
  MessagesSquare,
  Flag,
  Inbox,
  ArrowRight,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { useLanguage } from "@/lib/i18n/language-context";
import { ListSkeleton, QueryError, EmptyState } from "@/components/crm/QueryState";
import { formatDate } from "@/lib/format";
import { useInteractionsFeed } from "@/lib/hooks/use-interactions-feed";

const TYPE_ICON: Record<string, typeof Users> = {
  meeting: Users,
  visit: MapPin,
  call: Phone,
  email: Mail,
  note: StickyNote,
};

function typeLabel(type: string, tr: (da: string, en: string) => string): string {
  switch (type) {
    case "meeting":
      return tr("Møde", "Meeting");
    case "visit":
      return tr("Besøg", "Visit");
    case "call":
      return tr("Opkald", "Call");
    case "email":
      return tr("E-mail", "Email");
    case "note":
      return tr("Notat", "Note");
    default:
      return type;
  }
}

export default function InteractionsFeedPage() {
  const { locale } = useLanguage();
  const tr = (da: string, en: string) => (locale === "da" ? da : en);
  const { data, isLoading, isError, error, refetch } = useInteractionsFeed();

  const items = data?.interactions ?? [];

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessagesSquare className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {tr("Interaktioner", "Interactions")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tr(
                "Seneste møder, opkald, e-mails og noter på tværs af dine virksomheder.",
                "Recent meetings, calls, emails, and notes across your companies."
              )}
            </p>
          </div>
        </div>

        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6 text-muted-foreground" />}
            title={tr("Ingen interaktioner endnu.", "No interactions yet.")}
            description={tr(
              "Log møder, opkald og noter fra en virksomhedsprofil — næste skridt bliver til en opgave.",
              "Log meetings, calls and notes from a company profile — next steps become tasks."
            )}
            action={
              <Link href="/records" className="text-sm font-semibold text-primary hover:underline">
                {tr("Find en virksomhed", "Find a company")}
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {items.map((i) => {
              const Icon = TYPE_ICON[i.type] ?? MessagesSquare;
              return (
                <div
                  key={i.id}
                  className="rounded-xl border border-border p-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Link
                      href={`/company/${i.companyVat}`}
                      className="group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors min-w-0"
                    >
                      <span className="truncate">
                        {i.companyName || `CVR ${i.companyVat}`}
                      </span>
                      <ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatDate(i.occurredAt, locale)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Icon className="size-3.5 text-primary" />
                    <span className="font-medium text-foreground">
                      {typeLabel(i.type, tr)}
                    </span>
                    {i.subject ? <span className="truncate">· {i.subject}</span> : null}
                  </div>

                  {i.body && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                      {i.body}
                    </p>
                  )}

                  {i.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {i.topics.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {i.nextStep && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-md px-2 py-1 mt-2 inline-flex items-center gap-1">
                      <Flag className="size-3" />
                      {tr("Næste", "Next")}: {i.nextStep}
                      {i.nextStepAt ? ` · ${formatDate(i.nextStepAt, locale)}` : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
