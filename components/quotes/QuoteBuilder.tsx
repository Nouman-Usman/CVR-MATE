"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { X, Plus, Trash2, FileText, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { useTr } from "@/lib/i18n/tr";
import { formatOre } from "@/lib/format";
import { computeDoc } from "@/lib/quotes/totals";
import {
  parseKronerToOre,
  parseQuantity,
  parsePercent,
  oreToInputString,
} from "@/lib/money/parse";
import { useProducts } from "@/lib/hooks/use-products";
import { CompanyCombobox } from "@/components/crm/CompanyCombobox";
import type { QuoteLineInput } from "@/lib/hooks/use-quotes";

/**
 * The quote line-item editor, shared by create and edit.
 *
 * It was previously inlined in `app/quotes/new/page.tsx`, which is why editing a
 * draft was impossible: the endpoint accepted line replacement but there was no
 * second place to render the form. Fixing a typo meant deleting the quote and
 * retyping every line.
 */

/** localStorage key for the unsent new-quote draft. */
export const QUOTE_DRAFT_KEY = "cvr-mate:quote-draft";

/** Module-level so the subscription identity is stable across renders. */
function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export interface BuilderRow {
  productId: string;
  description: string;
  qty: string;
  price: string; // kroner as typed
  discountPct: string;
  vatRate: string;
}

export const emptyBuilderRow = (): BuilderRow => ({
  productId: "",
  description: "",
  qty: "1",
  price: "",
  discountPct: "0",
  vatRate: "25",
});

export interface QuoteBuilderValue {
  company: { vat: string; name: string } | null;
  issueDate: string;
  validUntil: string;
  terms: string;
  rows: BuilderRow[];
}

export const emptyBuilderValue = (): QuoteBuilderValue => ({
  company: null,
  issueDate: "",
  validUntil: "",
  terms: "",
  rows: [emptyBuilderRow()],
});

interface ParsedRow {
  quantity: number | null;
  unitPrice: number | null;
  discountPct: number | null;
  vatRate: number | null;
}

/**
 * Every numeric field parsed, with `null` meaning "the user typed something we
 * cannot read". Nulls block the save — coercing them to 0 produces a
 * zero-priced line that looks deliberate and reaches the customer.
 */
function parseRow(r: BuilderRow): ParsedRow {
  return {
    quantity: parseQuantity(r.qty),
    unitPrice: parseKronerToOre(r.price),
    discountPct: parsePercent(r.discountPct),
    vatRate: parsePercent(r.vatRate),
  };
}

type FieldKey = "qty" | "price" | "discount" | "vat";

/** Per-field errors for one row, so the message can sit next to the input. */
function rowErrors(r: BuilderRow): Partial<Record<FieldKey, true>> {
  const p = parseRow(r);
  const errs: Partial<Record<FieldKey, true>> = {};
  if (p.quantity === null || p.quantity <= 0) errs.qty = true;
  if (p.unitPrice === null || p.unitPrice < 0) errs.price = true;
  if (p.discountPct === null || p.discountPct < 0 || p.discountPct > 100) errs.discount = true;
  if (p.vatRate === null || p.vatRate < 0 || p.vatRate > 100) errs.vat = true;
  return errs;
}

const inputCls =
  "w-full px-2.5 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40";
const inputErrCls =
  "w-full px-2.5 py-2 rounded-lg border border-destructive text-sm bg-background focus:outline-none focus:ring-2 focus:ring-destructive/40";

export function QuoteBuilder({
  title,
  submitLabel,
  initial,
  lockCompany = false,
  isPending = false,
  draftKey,
  onSubmit,
  onCancel,
}: {
  title: string;
  submitLabel: string;
  initial: QuoteBuilderValue;
  /** Edit mode: the customer cannot be changed (the API has no such field). */
  lockCompany?: boolean;
  isPending?: boolean;
  /** localStorage key for crash/navigation recovery. Omit to disable. */
  draftKey?: string;
  onSubmit: (payload: {
    cvr: string;
    issueDate?: string;
    validUntil?: string;
    terms?: string;
    lines: QuoteLineInput[];
  }) => void;
  onCancel: () => void;
}) {
  const { locale } = useLanguage();
  const { tr } = useTr();
  const { data: productData } = useProducts();
  const products = productData?.products ?? [];

  const [value, setValue] = useState<QuoteBuilderValue>(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [restoreDismissed, setRestoreDismissed] = useState(false);

  const { company, issueDate, validUntil, terms, rows } = value;
  // State, not a ref: the dirty check runs during render, and refs may not be
  // read there. The lazy initializer keeps it to one snapshot for the lifetime.
  const [pristine] = useState(() => JSON.stringify(initial));
  const dirty = JSON.stringify(value) !== pristine;
  const submitted = useRef(false);

  // ── Draft recovery ────────────────────────────────────────────────────────
  // A half-built quote is many minutes of typing; losing it to a stray back
  // button is the kind of thing people abandon a tool over. Kept client-side:
  // no schema, no orphan-draft cleanup, and the data is worthless until sent.
  //
  // localStorage is an external store, so it is read through
  // useSyncExternalStore rather than an effect+setState: that keeps the server
  // render (null) and the client render consistent without a hydration mismatch.
  const rawDraft = useSyncExternalStore(
    subscribeToStorage,
    () => (draftKey ? window.localStorage.getItem(draftKey) : null),
    () => null
  );

  const savedDraft = useMemo<QuoteBuilderValue | null>(() => {
    if (!rawDraft) return null;
    try {
      return JSON.parse(rawDraft) as QuoteBuilderValue;
    } catch {
      return null; // Corrupt draft — nothing worth recovering.
    }
  }, [rawDraft]);

  useEffect(() => {
    if (!draftKey || !dirty || submitted.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(value));
      } catch {
        // Quota or private mode — the guard below still protects the user.
      }
    }, 600);
    return () => clearTimeout(t);
  }, [draftKey, dirty, value]);

  // ── Unsaved-changes guard ─────────────────────────────────────────────────
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (submitted.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const parsedRows = useMemo(() => rows.map(rowErrors), [rows]);

  // Preview only sums the lines that currently parse, so a half-typed price
  // never silently contributes 0 to a total the user is reading.
  const totals = useMemo(() => {
    const valid = rows
      .map((r, i) => ({ r, ok: Object.keys(parsedRows[i]).length === 0 }))
      .filter((x) => x.ok)
      .map((x) => {
        const p = parseRow(x.r);
        return {
          quantity: p.quantity as number,
          unitPrice: p.unitPrice as number,
          discountPct: p.discountPct as number,
          vatRate: p.vatRate as number,
        };
      });
    return computeDoc(valid).totals;
  }, [rows, parsedRows]);

  // Only offered before the user starts typing — once the form is dirty the
  // autosave is writing this same key, so restoring would be a no-op anyway.
  const showRestore = !!draftKey && !!savedDraft && !dirty && !restoreDismissed;

  const filledRows = rows.filter((r) => r.description.trim());
  const hasInvalid = rows.some(
    (r, i) => r.description.trim() && Object.keys(parsedRows[i]).length > 0
  );
  const datesInverted = !!issueDate && !!validUntil && validUntil < issueDate;

  function patch(p: Partial<QuoteBuilderValue>) {
    setValue((v) => ({ ...v, ...p }));
  }
  function setRow(i: number, p: Partial<BuilderRow>) {
    setValue((v) => ({
      ...v,
      rows: v.rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)),
    }));
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
      price: oreToInputString(p.unitPrice, locale === "da" ? "da" : "en"),
      vatRate: p.vatRate,
    });
  }

  function handleSubmit() {
    setShowErrors(true);
    if (!company) return;
    if (filledRows.length === 0 || hasInvalid || datesInverted) return;

    submitted.current = true;
    if (draftKey) localStorage.removeItem(draftKey);

    onSubmit({
      cvr: company.vat,
      issueDate: issueDate || undefined,
      validUntil: validUntil || undefined,
      terms: terms.trim() || undefined,
      lines: rows
        .filter((r) => r.description.trim())
        .map((r) => {
          const p = parseRow(r);
          return {
            productId: r.productId || undefined,
            description: r.description.trim(),
            quantity: p.quantity as number,
            unitPrice: p.unitPrice as number,
            discountPct: p.discountPct as number,
            vatRate: p.vatRate as number,
          };
        }),
    });
  }

  function handleCancel() {
    if (dirty && !window.confirm(tr("Kassér ændringer?", "Discard changes?"))) return;
    if (draftKey) localStorage.removeItem(draftKey);
    onCancel();
  }

  const fieldLabel: Record<FieldKey, string> = {
    qty: tr("Antal", "Qty"),
    price: tr("Pris (DKK)", "Price (DKK)"),
    discount: tr("Rabat %", "Disc. %"),
    vat: tr("Moms %", "VAT %"),
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="size-5 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
      </div>

      {showRestore && savedDraft && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {tr("Du har et gemt udkast.", "You have a saved draft.")}
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => {
                setValue(savedDraft);
                setRestoreDismissed(true);
              }}
              className="text-sm font-semibold text-amber-900 dark:text-amber-200 hover:underline"
            >
              {tr("Gendan", "Restore")}
            </button>
            <button
              onClick={() => {
                if (draftKey) localStorage.removeItem(draftKey);
                setRestoreDismissed(true);
              }}
              className="text-sm text-amber-700 dark:text-amber-400 hover:underline"
            >
              {tr("Kassér", "Discard")}
            </button>
          </div>
        </div>
      )}

      {/* Company */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {tr("Kunde", "Customer")} <span className="text-destructive">*</span>
        </h2>
        {company ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-primary/5 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{company.name}</p>
              <p className="text-xs text-muted-foreground">CVR {company.vat}</p>
            </div>
            {!lockCompany && (
              <button onClick={() => patch({ company: null })} aria-label={tr("Skift", "Change")}>
                <X className="size-4 text-muted-foreground" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <CompanyCombobox
              autoFocus
              invalid={showErrors}
              label={tr("Søg virksomhed", "Search company")}
              placeholder={tr("Søg virksomhedsnavn…", "Search company name…")}
              inputClassName={showErrors ? inputErrCls : inputCls}
              loadingLabel={tr("Søger…", "Searching…")}
              emptyLabel={tr("Ingen resultater", "No results")}
              countLabel={(n) =>
                tr(`${n} virksomheder fundet`, `${n} companies found`)
              }
              onSelect={(c) => patch({ company: { vat: c.vat, name: c.name } })}
            />
            {showErrors && (
              <p className="text-xs text-destructive">
                {tr("Vælg en virksomhed.", "Select a company.")}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground" htmlFor="qb-issue-date">
          {tr("Dato", "Issue date")}
          <input
            id="qb-issue-date"
            type="date"
            className={inputCls}
            value={issueDate}
            onChange={(e) => patch({ issueDate: e.target.value })}
          />
        </label>
        <label className="text-xs text-muted-foreground" htmlFor="qb-valid-until">
          {tr("Gyldig til", "Valid until")}
          <input
            id="qb-valid-until"
            type="date"
            className={datesInverted ? inputErrCls : inputCls}
            value={validUntil}
            onChange={(e) => patch({ validUntil: e.target.value })}
          />
          {datesInverted && (
            <span className="block text-xs text-destructive mt-1">
              {tr(
                "Gyldig til skal være efter datoen.",
                "Valid until must be on or after the issue date."
              )}
            </span>
          )}
        </label>
      </div>

      {/* Lines */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {tr("Linjer", "Line items")} <span className="text-destructive">*</span>
        </h2>
        <div className="space-y-2">
          {rows.map((r, i) => {
            const errs = parsedRows[i];
            const show = showErrors && !!r.description.trim();
            return (
              <div key={i} className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex gap-2">
                  {products.length > 0 && (
                    <select
                      aria-label={tr("Produkt", "Product")}
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
                    aria-label={tr("Beskrivelse", "Description")}
                    className={inputCls}
                    placeholder={tr("Beskrivelse", "Description")}
                    value={r.description}
                    onChange={(e) => setRow(i, { description: e.target.value })}
                  />
                  {rows.length > 1 && (
                    <button
                      onClick={() =>
                        setValue((v) => ({ ...v, rows: v.rows.filter((_, idx) => idx !== i) }))
                      }
                      className="text-muted-foreground hover:text-rose-500 shrink-0"
                      aria-label={tr("Fjern linje", "Remove line")}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                {/* 4 columns at ~64px each is unusable on a phone. */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["qty", "price", "discount", "vat"] as FieldKey[]).map((key) => {
                    const val =
                      key === "qty"
                        ? r.qty
                        : key === "price"
                          ? r.price
                          : key === "discount"
                            ? r.discountPct
                            : r.vatRate;
                    const onChange = (s: string) =>
                      setRow(
                        i,
                        key === "qty"
                          ? { qty: s }
                          : key === "price"
                            ? { price: s }
                            : key === "discount"
                              ? { discountPct: s }
                              : { vatRate: s }
                      );
                    const bad = show && errs[key];
                    return (
                      <label key={key} className="text-[10px] text-muted-foreground">
                        {fieldLabel[key]}
                        <input
                          className={bad ? inputErrCls : inputCls}
                          inputMode="decimal"
                          value={val}
                          onChange={(e) => onChange(e.target.value)}
                        />
                        {bad && (
                          <span className="block text-[10px] text-destructive mt-0.5">
                            {tr("Ugyldig", "Invalid")}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => setValue((v) => ({ ...v, rows: [...v.rows, emptyBuilderRow()] }))}
          className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
        >
          <Plus className="size-4" />
          {tr("Tilføj linje", "Add line")}
        </button>
        {showErrors && filledRows.length === 0 && (
          <p className="text-xs text-destructive">
            {tr("Tilføj mindst én linje med beskrivelse.", "Add at least one described line.")}
          </p>
        )}
      </section>

      {/* Totals */}
      <div className="rounded-xl border border-border p-4 space-y-1.5 text-sm">
        <TotalRow label={tr("Subtotal", "Subtotal")} value={formatOre(totals.subtotal, locale)} />
        {totals.discountTotal > 0 && (
          <TotalRow
            label={tr("Rabat", "Discount")}
            value={"−" + formatOre(totals.discountTotal, locale)}
          />
        )}
        <TotalRow label={tr("Moms", "VAT")} value={formatOre(totals.vatTotal, locale)} />
        <div className="border-t border-border pt-1.5 mt-1.5">
          <TotalRow label={tr("Total", "Total")} value={formatOre(totals.total, locale)} bold />
        </div>
      </div>

      <label className="block text-xs text-muted-foreground" htmlFor="qb-terms">
        {tr("Betingelser (valgfri)", "Terms (optional)")}
        <textarea
          id="qb-terms"
          className={inputCls + " resize-none mt-1"}
          rows={2}
          value={terms}
          onChange={(e) => patch({ terms: e.target.value })}
        />
      </label>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={handleCancel}
          className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground"
        >
          {tr("Annullér", "Cancel")}
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-bold text-foreground" : "text-muted-foreground"}>{label}</span>
      <span
        className={bold ? "font-bold text-foreground tabular-nums" : "text-foreground tabular-nums"}
      >
        {value}
      </span>
    </div>
  );
}
