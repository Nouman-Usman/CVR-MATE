"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Check, Truck, X, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatOre, formatDate } from "@/lib/format";
import { useOrder, useUpdateOrder } from "@/lib/hooks/use-orders";
import { ORDER_STATUS_STYLE } from "../page";

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { locale } = useLanguage();
  const tr = (da: string, en: string) => (locale === "da" ? da : en);

  const { data, isLoading } = useOrder(id);
  const update = useUpdateOrder(id);

  const order = data?.order;
  const lines = data?.lines ?? [];
  const company = data?.company ?? null;

  function setStatus(status: string) {
    update.mutate({ status }, { onError: (e) => toast.error((e as Error).message) });
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          {tr("Ordrer", "Orders")}
        </Link>

        {isLoading || !order ? (
          <p className="text-sm text-muted-foreground py-12 text-center">{tr("Indlæser…", "Loading…")}</p>
        ) : (
          <>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{order.number}</h1>
                <span
                  className={
                    "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full " +
                    (ORDER_STATUS_STYLE[order.status] ?? ORDER_STATUS_STYLE.open)
                  }
                >
                  {order.status}
                </span>
              </div>
              {company && (
                <Link href={`/company/${company.vat}`} className="text-sm text-muted-foreground hover:text-primary">
                  {company.name} · CVR {company.vat}
                </Link>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {order.orderDate ? `${tr("Dato", "Date")}: ${formatDate(order.orderDate, locale)}` : ""}
                {order.expectedDelivery ? ` · ${tr("Levering", "Delivery")}: ${formatDate(order.expectedDelivery, locale)}` : ""}
                {order.quoteId ? (
                  <>
                    {" · "}
                    <Link href={`/quotes/${order.quoteId}`} className="hover:text-primary underline">
                      {tr("Fra tilbud", "From quote")}
                    </Link>
                  </>
                ) : null}
              </p>
            </div>

            {/* Status actions */}
            <div className="flex flex-wrap gap-2">
              {order.status === "open" && (
                <StatusBtn onClick={() => setStatus("confirmed")} busy={update.isPending} icon={Check} label={tr("Bekræft", "Confirm")} primary />
              )}
              {order.status === "confirmed" && (
                <StatusBtn onClick={() => setStatus("fulfilled")} busy={update.isPending} icon={Truck} label={tr("Opfyld", "Fulfill")} primary />
              )}
              {order.status !== "cancelled" && order.status !== "fulfilled" && (
                <StatusBtn onClick={() => setStatus("cancelled")} busy={update.isPending} icon={X} label={tr("Annullér", "Cancel")} />
              )}
            </div>

            {/* Lines */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">{tr("Beskrivelse", "Description")}</th>
                      <th className="text-right font-medium px-3 py-2">{tr("Antal", "Qty")}</th>
                      <th className="text-right font-medium px-3 py-2">{tr("Pris", "Price")}</th>
                      <th className="text-right font-medium px-3 py-2">{tr("Moms", "VAT")}</th>
                      <th className="text-right font-medium px-3 py-2">{tr("Beløb", "Amount")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lines.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2 text-foreground">{l.description}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatOre(l.unitPrice, locale)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.vatRate}%</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatOre(l.lineSubtotal, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border p-3 space-y-1 text-sm max-w-xs ml-auto">
                <Line label={tr("Subtotal", "Subtotal")} value={formatOre(order.subtotal, locale)} />
                {order.discountTotal > 0 && <Line label={tr("Rabat", "Discount")} value={"−" + formatOre(order.discountTotal, locale)} />}
                <Line label={tr("Moms", "VAT")} value={formatOre(order.vatTotal, locale)} />
                <div className="border-t border-border pt-1 mt-1">
                  <Line label={tr("Total", "Total")} value={formatOre(order.total, locale)} bold />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatusBtn({
  onClick,
  busy,
  icon: Icon,
  label,
  primary,
}: {
  onClick: () => void;
  busy: boolean;
  icon: typeof Check;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 " +
        (primary ? "bg-primary text-primary-foreground hover:opacity-90" : "border border-border hover:bg-muted")
      }
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      {label}
    </button>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-bold text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={"tabular-nums " + (bold ? "font-bold text-foreground" : "text-foreground")}>{value}</span>
    </div>
  );
}
