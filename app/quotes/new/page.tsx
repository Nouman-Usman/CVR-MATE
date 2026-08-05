"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, X, Plus, Trash2, FileText, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatOre } from "@/lib/format";
import { computeDoc } from "@/lib/quotes/totals";
import { useSuggestions } from "@/lib/hooks/use-suggestions";
import { useProducts } from "@/lib/hooks/use-products";
import { useCreateQuote } from "@/lib/hooks/use-quotes";

interface Row {
  productId: string;
  description: string;
  qty: string;
  price: string; // DKK
  discountPct: string;
  vatRate: string;
}

const emptyRow = (): Row => ({
  productId: "",
  description: "",
  qty: "1",
  price: "",
  discountPct: "0",
  vatRate: "25",
});

function dkkToOre(s: string): number {
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

const inputCls =
  "w-full px-2.5 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function NewQuotePage() {
  const { locale } = useLanguage();
  const tr = (da: string, en: string) => (locale === "da" ? da : en);
  const router = useRouter();
  const createQuote = useCreateQuote();
  const { data: productData } = useProducts();
  const products = productData?.products ?? [];

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<{ vat: string; name: string } | null>(null);
  const [issueDate, setIssueDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [terms, setTerms] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const { data: suggestions, isFetching } = useSuggestions(debounced);

  const totals = useMemo(() => {
    return computeDoc(
      rows.map((r) => ({
        quantity: Number(r.qty) || 0,
        unitPrice: dkkToOre(r.price),
        discountPct: Number(r.discountPct) || 0,
        vatRate: Number(r.vatRate) || 0,
      }))
    ).totals;
  }, [rows]);

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function pickProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) {
      setRow(i, { productId: "" });
      return;
    }
    setRow(i, {
      productId,
      description: p.name,
      price: (p.unitPrice / 100).toString(),
      vatRate: p.vatRate,
    });
  }

  function save() {
    if (!picked) {
      toast.error(tr("Vælg en virksomhed", "Select a company"));
      return;
    }
    const lines = rows
      .filter((r) => r.description.trim())
      .map((r) => ({
        productId: r.productId || undefined,
        description: r.description.trim(),
        quantity: Number(r.qty) || 0,
        unitPrice: dkkToOre(r.price),
        discountPct: Number(r.discountPct) || 0,
        vatRate: Number(r.vatRate) || 25,
      }));
    if (lines.length === 0) {
      toast.error(tr("Tilføj mindst én linje", "Add at least one line"));
      return;
    }
    createQuote.mutate(
      {
        cvr: picked.vat,
        issueDate: issueDate || undefined,
        validUntil: validUntil || undefined,
        terms: terms.trim() || undefined,
        lines,
      },
      {
        onSuccess: (res) => {
          toast.success(tr("Tilbud oprettet", "Quote created"));
          router.push(`/quotes/${res.quote.id}`);
        },
        onError: (e) => toast.error((e as Error).message),
      }
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="size-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{tr("Nyt tilbud", "New quote")}</h1>
        </div>

        {/* Company */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {tr("Kunde", "Customer")}
          </h2>
          {picked ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-primary/5 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{picked.name}</p>
                <p className="text-xs text-muted-foreground">CVR {picked.vat}</p>
              </div>
              <button onClick={() => setPicked(null)} aria-label={tr("Skift", "Change")}>
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  className={inputCls + " pl-8"}
                  placeholder={tr("Søg virksomhedsnavn…", "Search company name…")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {debounced.length >= 2 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {isFetching && (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      {tr("Søger…", "Searching…")}
                    </p>
                  )}
                  {suggestions?.results.map((r) => (
                    <button
                      key={r.vat}
                      onClick={() =>
                        setPicked({ vat: String(r.vat), name: r.life?.name || `CVR ${r.vat}` })
                      }
                      className="w-full text-left px-3 py-2 hover:bg-muted"
                    >
                      <p className="text-sm font-medium text-foreground truncate">{r.life?.name}</p>
                      <p className="text-xs text-muted-foreground">CVR {r.vat}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-muted-foreground">
            {tr("Dato", "Issue date")}
            <input type="date" className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">
            {tr("Gyldig til", "Valid until")}
            <input type="date" className={inputCls} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </label>
        </div>

        {/* Lines */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {tr("Linjer", "Line items")}
          </h2>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex gap-2">
                  {products.length > 0 && (
                    <select
                      className={inputCls + " max-w-[40%]"}
                      value={r.productId}
                      onChange={(e) => pickProduct(i, e.target.value)}
                    >
                      <option value="">{tr("— Produkt —", "— Product —")}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    className={inputCls}
                    placeholder={tr("Beskrivelse", "Description")}
                    value={r.description}
                    onChange={(e) => setRow(i, { description: e.target.value })}
                  />
                  {rows.length > 1 && (
                    <button
                      onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-rose-500 shrink-0"
                      aria-label={tr("Fjern", "Remove")}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <label className="text-[10px] text-muted-foreground">
                    {tr("Antal", "Qty")}
                    <input className={inputCls} inputMode="decimal" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} />
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    {tr("Pris (DKK)", "Price (DKK)")}
                    <input className={inputCls} inputMode="decimal" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} />
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    {tr("Rabat %", "Disc. %")}
                    <input className={inputCls} inputMode="decimal" value={r.discountPct} onChange={(e) => setRow(i, { discountPct: e.target.value })} />
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    {tr("Moms %", "VAT %")}
                    <input className={inputCls} inputMode="decimal" value={r.vatRate} onChange={(e) => setRow(i, { vatRate: e.target.value })} />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
            className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
          >
            <Plus className="size-4" />
            {tr("Tilføj linje", "Add line")}
          </button>
        </section>

        {/* Totals */}
        <div className="rounded-xl border border-border p-4 space-y-1.5 text-sm">
          <Row label={tr("Subtotal", "Subtotal")} value={formatOre(totals.subtotal, locale)} />
          {totals.discountTotal > 0 && (
            <Row label={tr("Rabat", "Discount")} value={"−" + formatOre(totals.discountTotal, locale)} />
          )}
          <Row label={tr("Moms", "VAT")} value={formatOre(totals.vatTotal, locale)} />
          <div className="border-t border-border pt-1.5 mt-1.5">
            <Row label={tr("Total", "Total")} value={formatOre(totals.total, locale)} bold />
          </div>
        </div>

        <textarea
          className={inputCls + " resize-none"}
          rows={2}
          placeholder={tr("Betingelser (valgfri)", "Terms (optional)")}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
        />

        <div className="flex items-center justify-end gap-2">
          <button onClick={() => router.back()} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground">
            {tr("Annullér", "Cancel")}
          </button>
          <button
            onClick={save}
            disabled={!picked || createQuote.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {createQuote.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            {tr("Opret tilbud", "Create quote")}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-bold text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "font-bold text-foreground tabular-nums" : "text-foreground tabular-nums"}>
        {value}
      </span>
    </div>
  );
}
