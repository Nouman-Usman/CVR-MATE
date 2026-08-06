"use client";

import Link from "next/link";
import { useState } from "react";
import { ShoppingCart, ArrowRight, Inbox } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { useLanguage } from "@/lib/i18n/language-context";
import { useTr } from "@/lib/i18n/tr";
import { formatOre, formatDate } from "@/lib/format";
import { useOrders } from "@/lib/hooks/use-orders";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { ListSkeleton, QueryError, EmptyState } from "@/components/crm/QueryState";
import { statusLabel, statusValues } from "@/lib/crm/status";

export default function OrdersPage() {
  const { locale } = useLanguage();
  const { tr } = useTr();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const { data, isLoading, isError, error, refetch } = useOrders(status);
  const orders = data?.orders ?? [];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShoppingCart className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{tr("Ordrer", "Orders")}</h1>
            <p className="text-sm text-muted-foreground">
              {tr("Ordrer konverteret fra accepterede tilbud.", "Orders converted from accepted quotes.")}
            </p>
          </div>
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
          {statusValues("order").map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {statusLabel("order", s, locale)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6 text-muted-foreground" />}
            title={
              status
                ? tr("Ingen ordrer med denne status.", "No orders with this status.")
                : tr("Ingen ordrer endnu.", "No orders yet.")
            }
            description={tr(
              "Ordrer oprettes ved at konvertere et accepteret tilbud.",
              "Orders are created by converting an accepted quote."
            )}
            action={
              <Link href="/quotes" className="text-sm font-semibold text-primary hover:underline">
                {tr("Gå til tilbud", "Go to quotes")}
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {typeof data?.total === "number" && data.total > orders.length && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {tr(
                  `Viser ${orders.length} af ${data.total} ordrer.`,
                  `Showing ${orders.length} of ${data.total} orders.`
                )}
              </p>
            )}
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{o.number}</span>
                    <StatusBadge kind="order" status={o.status} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {o.companyName || `CVR ${o.companyVat}`}
                    {o.orderDate ? ` · ${formatDate(o.orderDate, locale)}` : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                  {formatOre(o.total, locale)}
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
