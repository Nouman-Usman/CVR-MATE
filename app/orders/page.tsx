"use client";

import Link from "next/link";
import { ShoppingCart, ArrowRight, Inbox } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatOre, formatDate } from "@/lib/format";
import { useOrders } from "@/lib/hooks/use-orders";

export const ORDER_STATUS_STYLE: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  fulfilled: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

export default function OrdersPage() {
  const { locale } = useLanguage();
  const tr = (da: string, en: string) => (locale === "da" ? da : en);
  const { data, isLoading } = useOrders();
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

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-12 text-center">{tr("Indlæser…", "Loading…")}</p>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Inbox className="size-8 opacity-40" />
            <p className="text-sm">
              {tr("Ingen ordrer endnu. Konvertér et accepteret tilbud.", "No orders yet. Convert an accepted quote.")}
            </p>
          </div>
        ) : (
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
                    <span
                      className={
                        "text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full " +
                        (ORDER_STATUS_STYLE[o.status] ?? ORDER_STATUS_STYLE.open)
                      }
                    >
                      {o.status}
                    </span>
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
        )}
      </div>
    </DashboardLayout>
  );
}
