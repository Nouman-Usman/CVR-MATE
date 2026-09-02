"use client";

import { toast } from "sonner";
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Send,
} from "lucide-react";

import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatOre, formatDate } from "@/lib/format";
import {
  useCreateDraftInvoice,
  useOrderInvoice,
  useSyncInvoices,
} from "@/lib/hooks/use-order-invoice";
import { useAccountingConnection } from "@/lib/hooks/use-accounting";

/**
 * Invoicing, as seen from an order.
 *
 * The panel is careful about one thing above all: it never claims the customer
 * has been invoiced. CVR-MATE creates a draft; a person books and sends it in
 * the accounting system, because booking allocates a legal invoice number and
 * is undone only by a credit note. Every label here reflects that division.
 */
export function OrderInvoicePanel({
  orderId,
  orderStatus,
}: {
  orderId: string;
  orderStatus: string;
}) {
  const { tr } = useTr();
  const { locale } = useLanguage();
  const errorMessage = useApiErrorMessage();

  const connection = useAccountingConnection();
  const { data, isPending } = useOrderInvoice(orderId);
  const create = useCreateDraftInvoice(orderId);
  const sync = useSyncInvoices(orderId);

  const invoice = data?.invoice ?? null;
  const connected = connection.data?.connection ?? null;

  // Nothing to say until the CRM is available and the order could be invoiced.
  if (connection.isPending || isPending) return null;

  if (!connected && !invoice) {
    return (
      <Shell title={tr("Fakturering", "Invoicing")}>
        <p className="text-sm text-muted-foreground">
          {tr(
            "Forbind et bogføringssystem for at sende ordren til fakturering.",
            "Connect a bookkeeping system to send this order for invoicing."
          )}
        </p>
      </Shell>
    );
  }

  if (!invoice) {
    const canInvoice = orderStatus === "fulfilled" || orderStatus === "confirmed";
    return (
      <Shell title={tr("Fakturering", "Invoicing")}>
        <p className="text-sm text-muted-foreground">
          {tr(
            "Vi opretter et fakturaudkast i dit bogføringssystem. Du bogfører og sender det selv.",
            "We create a draft invoice in your bookkeeping system. You book and send it yourself."
          )}
        </p>
        <button
          onClick={() =>
            create.mutate(undefined, {
              onSuccess: (r) =>
                toast.success(
                  r.totalsMismatch
                    ? tr("Udkast oprettet — beløb afviger", "Draft created — amounts differ")
                    : tr("Fakturaudkast oprettet", "Draft invoice created")
                ),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
          disabled={!canInvoice || create.isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {create.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {tr("Opret fakturaudkast", "Create draft invoice")}
        </button>
        {!canInvoice && (
          <p className="text-xs text-muted-foreground">
            {tr(
              "Bekræft eller opfyld ordren først.",
              "Confirm or fulfill the order first."
            )}
          </p>
        )}
      </Shell>
    );
  }

  return (
    <Shell title={tr("Fakturering", "Invoicing")}>
      <div className="flex flex-wrap items-center gap-2">
        <InvoiceStatusBadge status={invoice.status} />
        <span className="text-sm text-foreground">
          {invoice.invoiceNumber
            ? tr(`Faktura ${invoice.invoiceNumber}`, `Invoice ${invoice.invoiceNumber}`)
            : tr("Udkast — endnu ikke bogført", "Draft — not booked yet")}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{tr("Beløb", "Amount")}</dt>
        <dd className="text-right tabular-nums text-foreground">
          {formatOre(invoice.total, locale)}
        </dd>
        {invoice.dueDate && (
          <>
            <dt className="text-muted-foreground">{tr("Betalingsfrist", "Due")}</dt>
            <dd className="text-right tabular-nums text-foreground">
              {formatDate(invoice.dueDate, locale)}
            </dd>
          </>
        )}
      </dl>

      {invoice.totalsMismatch && (
        // The one thing that must never be quiet: the invoice the customer will
        // receive does not add up to the order they agreed.
        <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {tr(
              "Bogføringssystemets beløb afviger fra ordren. Kontrollér momszone og produktopsætning, før du bogfører.",
              "The bookkeeping system's amount differs from the order. Check the VAT zone and product setup before booking."
            )}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {invoice.pdfUrl && (
          <a
            href={invoice.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <FileText className="size-3.5" />
            {tr("Åbn PDF", "Open PDF")}
            <ExternalLink className="size-3" />
          </a>
        )}
        <button
          onClick={() =>
            sync.mutate(undefined, {
              onSuccess: (r) =>
                toast.success(
                  r.updated > 0
                    ? tr("Status opdateret", "Status updated")
                    : tr("Ingen ændringer", "No changes")
                ),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
          disabled={sync.isPending}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        >
          {sync.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          {tr("Opdatér status", "Refresh status")}
        </button>
      </div>

      {invoice.status === "draft" && (
        <p className="text-xs text-muted-foreground">
          {tr(
            "Bogfør og send fakturaen i dit bogføringssystem.",
            "Book and send the invoice in your bookkeeping system."
          )}
        </p>
      )}
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  booked: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  credited: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  cancelled: "bg-muted text-muted-foreground",
};

function InvoiceStatusBadge({ status }: { status: string }) {
  const { tr } = useTr();
  const label: Record<string, string> = {
    draft: tr("Udkast", "Draft"),
    booked: tr("Bogført", "Booked"),
    sent: tr("Sendt", "Sent"),
    paid: tr("Betalt", "Paid"),
    overdue: tr("Forfalden", "Overdue"),
    credited: tr("Krediteret", "Credited"),
    cancelled: tr("Annulleret", "Cancelled"),
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[status] ?? STATUS_TONE.draft}`}
    >
      {label[status] ?? status}
    </span>
  );
}
