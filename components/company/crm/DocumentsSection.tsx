"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, FileText, Package, Plus, type LucideIcon } from "lucide-react";
import { useTr } from "@/lib/i18n/tr";
import { formatDate, formatOre } from "@/lib/format";
import { useCompanyDocuments } from "@/lib/hooks/use-company-documents";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { ListSkeleton, QueryError, EmptyState } from "@/components/crm/QueryState";
import type { StatusKind } from "@/lib/crm/status";
import { card, primaryBtn, SectionHeader } from "./shared";

/**
 * What has been quoted to and ordered by this company — the question a
 * salesperson opens a company profile to answer, so it sits directly under the
 * contacts.
 */
export function DocumentsSection({ vat }: { vat: string }) {
  const { tr, locale } = useTr();
  const { data, isLoading, isError, error, refetch } = useCompanyDocuments(vat);

  const quotes = data?.quotes ?? [];
  const orders = data?.orders ?? [];
  const total = quotes.length + orders.length;

  return (
    <div className={card}>
      <SectionHeader
        icon={FileText}
        title={tr("Dokumenter", "Documents")}
        count={total}
        action={
          <Link href="/quotes/new" className={primaryBtn + " inline-flex items-center gap-1.5"}>
            <Plus className="size-3.5" />
            {tr("Nyt tilbud", "New quote")}
          </Link>
        }
      />

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <QueryError error={error} onRetry={() => refetch()} />
      ) : total === 0 ? (
        <EmptyState
          icon={<FileText className="size-6 text-muted-foreground" />}
          title={tr("Ingen tilbud eller ordrer endnu.", "No quotes or orders yet.")}
          description={tr(
            "Opret et tilbud med linjer, rabat og moms — accepterede tilbud bliver til ordrer.",
            "Build a quote with line items, discounts and VAT — accepted quotes become orders."
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
        <div className="space-y-4">
          {quotes.length > 0 && (
            <DocGroup icon={FileText} label={tr("Tilbud", "Quotes")}>
              {quotes.map((q) => (
                <DocRow
                  key={q.id}
                  href={`/quotes/${q.id}`}
                  number={q.number}
                  kind="quote"
                  status={q.status}
                  total={q.total}
                  locale={locale}
                  meta={[
                    q.issueDate ? formatDate(q.issueDate, locale) : null,
                    q.validUntil
                      ? `${tr("gyldig til", "valid until")} ${formatDate(q.validUntil, locale)}`
                      : null,
                  ]}
                />
              ))}
            </DocGroup>
          )}

          {orders.length > 0 && (
            <DocGroup icon={Package} label={tr("Ordrer", "Orders")}>
              {orders.map((o) => (
                <DocRow
                  key={o.id}
                  href={`/orders/${o.id}`}
                  number={o.number}
                  kind="order"
                  status={o.status}
                  total={o.total}
                  locale={locale}
                  meta={[
                    o.orderDate ? formatDate(o.orderDate, locale) : null,
                    o.expectedDelivery
                      ? `${tr("forventet", "expected")} ${formatDate(o.expectedDelivery, locale)}`
                      : null,
                  ]}
                />
              ))}
            </DocGroup>
          )}
        </div>
      )}
    </div>
  );
}

function DocGroup({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
        <Icon className="size-3.5" />
        {label}
      </p>
      <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function DocRow({
  href,
  number,
  kind,
  status,
  total,
  meta,
  locale,
}: {
  href: string;
  number: string;
  kind: StatusKind;
  status: string;
  total: number;
  meta: (string | null)[];
  locale: string;
}) {
  const subtitle = meta.filter(Boolean).join(" · ");
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{number}</span>
          <StatusBadge kind={kind} status={status} />
        </div>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
        {formatOre(total, locale)}
      </span>
      <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </Link>
  );
}
