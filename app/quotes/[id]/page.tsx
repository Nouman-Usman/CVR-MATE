"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Check,
  X,
  FileDown,
  Trash2,
  ShoppingCart,
  Loader2,
  Pencil,
  Copy,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { useLanguage } from "@/lib/i18n/language-context";
import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";
import { formatOre, formatDate } from "@/lib/format";
import {
  useQuote,
  useQuoteStatus,
  useConvertQuote,
  useDeleteQuote,
  useDuplicateQuote,
} from "@/lib/hooks/use-quotes";
import { generateQuotePdf } from "@/lib/quotes/pdf";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { ConfirmDialog } from "@/components/crm/ConfirmDialog";
import { ListSkeleton, QueryError, NotFoundState } from "@/components/crm/QueryState";

export default function QuoteDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { locale } = useLanguage();
  const { tr } = useTr();
  const errorMessage = useApiErrorMessage();

  const { data, isLoading, isError, error, refetch } = useQuote(id);
  const status = useQuoteStatus(id);
  const convert = useConvertQuote(id);
  const del = useDeleteQuote();
  const duplicate = useDuplicateQuote(id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const quote = data?.quote;
  const lines = data?.lines ?? [];
  const company = data?.company ?? null;
  const busy = status.isPending || convert.isPending || del.isPending || duplicate.isPending;
  const onError = (e: unknown) => toast.error(errorMessage(e));

  async function downloadPdf() {
    if (!quote) return;
    try {
      await generateQuotePdf(
        {
          number: quote.number,
          companyName: company?.name ?? "",
          companyVat: company?.vat ?? "",
          issueDate: quote.issueDate,
          validUntil: quote.validUntil,
          subtotal: quote.subtotal,
          discountTotal: quote.discountTotal,
          vatTotal: quote.vatTotal,
          total: quote.total,
          terms: quote.terms,
          lines: lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountPct: l.discountPct,
            vatRate: l.vatRate,
            lineSubtotal: l.lineSubtotal,
          })),
        },
        locale
      );
    } catch {
      toast.error(tr("PDF fejlede", "PDF failed"));
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Link href="/quotes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          {tr("Tilbud", "Quotes")}
        </Link>

        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} />
        ) : !quote ? (
          // Previously `isLoading || !quote` showed a spinner forever on a 404.
          <NotFoundState
            title={tr("Tilbuddet findes ikke.", "This quote does not exist.")}
            action={
              <Link href="/quotes" className="text-sm font-semibold text-primary hover:underline">
                {tr("Tilbage til tilbud", "Back to quotes")}
              </Link>
            }
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{quote.number}</h1>
                  <StatusBadge kind="quote" status={quote.status} />
                </div>
                {company && (
                  <Link href={`/company/${company.vat}`} className="text-sm text-muted-foreground hover:text-primary">
                    {company.name} · CVR {company.vat}
                  </Link>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {quote.issueDate ? `${tr("Dato", "Date")}: ${formatDate(quote.issueDate, locale)}` : ""}
                  {quote.validUntil ? ` · ${tr("Gyldig til", "Valid until")}: ${formatDate(quote.validUntil, locale)}` : ""}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button onClick={downloadPdf} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
                <FileDown className="size-4" />
                {tr("PDF", "PDF")}
              </button>
              {quote.status === "draft" && (
                <>
                  <Link
                    href={`/quotes/${id}/edit`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
                  >
                    <Pencil className="size-4" />
                    {tr("Redigér", "Edit")}
                  </Link>
                  <ActionBtn onClick={() => status.mutate("send", { onError })} busy={busy} icon={Send} label={tr("Send", "Send")} primary />
                </>
              )}
              <ActionBtn
                onClick={() =>
                  duplicate.mutate(undefined, {
                    onSuccess: (res) => {
                      toast.success(tr("Tilbud dubleret", "Quote duplicated"));
                      router.push(`/quotes/${res.quote.id}/edit`);
                    },
                    onError,
                  })
                }
                busy={busy}
                icon={Copy}
                label={tr("Dublér", "Duplicate")}
              />
              {quote.status === "sent" && (
                <>
                  <ActionBtn onClick={() => status.mutate("accept", { onError })} busy={busy} icon={Check} label={tr("Accepter", "Accept")} primary />
                  <ActionBtn onClick={() => status.mutate("reject", { onError })} busy={busy} icon={X} label={tr("Afvis", "Reject")} />
                </>
              )}
              {quote.status === "accepted" && (
                <ActionBtn
                  onClick={() =>
                    convert.mutate(undefined, {
                      onSuccess: (res) => {
                        toast.success(tr("Ordre oprettet", "Order created"));
                        router.push(`/orders/${res.order.id}`);
                      },
                      onError,
                    })
                  }
                  busy={busy}
                  icon={ShoppingCart}
                  label={tr("Konvertér til ordre", "Convert to order")}
                  primary
                />
              )}
              {quote.status === "converted" && quote.convertedOrderId && (
                <Link href={`/orders/${quote.convertedOrderId}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
                  <ShoppingCart className="size-4" />
                  {tr("Se ordre", "View order")}
                </Link>
              )}
              {quote.status !== "converted" && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50 ml-auto"
                >
                  <Trash2 className="size-4" />
                  {tr("Slet", "Delete")}
                </button>
              )}
            </div>

            <ConfirmDialog
              open={confirmDelete}
              onOpenChange={setConfirmDelete}
              title={tr("Slet tilbud?", "Delete quote?")}
              name={`${quote.number}${company ? ` · ${company.name}` : ""}`}
              description={tr("Dette kan ikke fortrydes.", "This cannot be undone.")}
              isPending={del.isPending}
              onConfirm={() =>
                del.mutate(quote.id, {
                  onSuccess: () => {
                    toast.success(tr("Slettet", "Deleted"));
                    router.push("/quotes");
                  },
                  onError,
                })
              }
            />

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
                <Line label={tr("Subtotal", "Subtotal")} value={formatOre(quote.subtotal, locale)} />
                {quote.discountTotal > 0 && <Line label={tr("Rabat", "Discount")} value={"−" + formatOre(quote.discountTotal, locale)} />}
                <Line label={tr("Moms", "VAT")} value={formatOre(quote.vatTotal, locale)} />
                <div className="border-t border-border pt-1 mt-1">
                  <Line label={tr("Total", "Total")} value={formatOre(quote.total, locale)} bold />
                </div>
              </div>
            </div>

            {quote.terms && (
              <div className="text-sm text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">{tr("Betingelser", "Terms")}</p>
                <p className="whitespace-pre-wrap">{quote.terms}</p>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function ActionBtn({
  onClick,
  busy,
  icon: Icon,
  label,
  primary,
}: {
  onClick: () => void;
  busy: boolean;
  icon: typeof Send;
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
