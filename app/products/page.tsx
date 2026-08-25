"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, X, Search } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import RequiresOrganization from "@/components/workspace/requires-organization";
import { useWorkspaces } from "@/lib/hooks/use-workspace";
import { useLanguage } from "@/lib/i18n/language-context";
import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";
import { useConfirm } from "@/components/crm/ConfirmDialog";
import { Field } from "@/components/crm/Field";
import { ListSkeleton, QueryError, EmptyState } from "@/components/crm/QueryState";
import { formatOre } from "@/lib/format";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  type Product,
} from "@/lib/hooks/use-products";

import { parseKronerToOre, parsePercent, oreToInputString } from "@/lib/money/parse";

const EMPTY = { name: "", sku: "", unit: "", price: "", vatRate: "25", active: true };

export default function ProductsPage() {
  const { locale } = useLanguage();
  const { isPersonal } = useWorkspaces();
  const { tr } = useTr();
  const errorMessage = useApiErrorMessage();
  const confirm = useConfirm();
  const { data, isLoading, isError, error, refetch } = useProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [filter, setFilter] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const allProducts = useMemo(() => data?.products ?? [], [data]);
  const products = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [allProducts, filter]);

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      unit: p.unit ?? "",
      price: oreToInputString(p.unitPrice, locale === "da" ? "da" : "en"),
      vatRate: p.vatRate,
      active: p.active,
    });
    // The edit form lives at the top of the page; without this, clicking the
    // pencil on a long list looks like nothing happened. Focus has to move too
    // — scrolling alone leaves a keyboard user's focus on a pencil button that
    // is now off-screen, with no indication that a form opened.
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    nameRef.current?.focus();
  }
  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }

  function submit() {
    if (!form.name.trim()) {
      toast.error(tr("Navn kræves", "Name is required"));
      return;
    }
    // Reject unreadable input instead of coercing it to 0 — a 0,00 kr catalog
    // price propagates into every quote line that picks the product.
    const unitPrice = parseKronerToOre(form.price);
    if (unitPrice === null || unitPrice < 0) {
      toast.error(tr("Ugyldig pris", "Invalid price"));
      return;
    }
    const vatRate = parsePercent(form.vatRate);
    if (vatRate === null || vatRate < 0 || vatRate > 100) {
      toast.error(tr("Ugyldig momssats", "Invalid VAT rate"));
      return;
    }

    const body = {
      name: form.name.trim(),
      sku: form.sku.trim() || undefined,
      unit: form.unit.trim() || undefined,
      unitPrice,
      vatRate,
      active: form.active,
    };
    const onDone = {
      onSuccess: () => reset(),
      onError: (e: Error) => toast.error(e.message),
    };
    if (editingId) updateProduct.mutate({ id: editingId, ...body }, onDone);
    else createProduct.mutate(body, onDone);
  }

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40";

  // This page's data is NOT NULL organization-scoped, so in the personal
  // workspace the API refuses it. Returning here — before any data-dependent
  // branch — is what stops a refusal being rendered as "nothing here yet",
  // which reads as a fact about the business rather than about the workspace.
  if (isPersonal) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <RequiresOrganization feature={tr("Produkter", "Products")} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{tr("Produkter", "Products")}</h1>
            <p className="text-sm text-muted-foreground">
              {tr(
                "Genanvendelige varelinjer til tilbud og ordrer.",
                "Reusable line items for quotes and orders."
              )}
            </p>
          </div>
        </div>

        {/* Create / edit form */}
        <div ref={formRef} className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {editingId ? tr("Redigér produkt", "Edit product") : tr("Nyt produkt", "New product")}
            </p>
            {editingId && (
              <button
                onClick={reset}
                className="text-muted-foreground hover:text-foreground"
                aria-label={tr("Annullér", "Cancel")}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label={tr("Navn", "Name")}>
              <input
                ref={nameRef}
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="SKU" hint={tr("(valgfri)", "(optional)")}>
              <input
                className={inputCls}
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </Field>
            <Field label={tr("Enhedspris", "Unit price")} hint="(DKK)">
              <input
                className={inputCls}
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
            <Field label={tr("Moms", "VAT")} hint="%">
              <input
                className={inputCls}
                inputMode="decimal"
                value={form.vatRate}
                onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
              />
            </Field>
            <Field label={tr("Enhed", "Unit")} hint={tr("(stk, time…)", "(pcs, hour…)")}>
              <input
                className={inputCls}
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-foreground px-1">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              {tr("Aktiv", "Active")}
            </label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={createProduct.isPending || updateProduct.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="size-4" />
              {editingId ? tr("Gem", "Save") : tr("Tilføj", "Add")}
            </button>
          </div>
        </div>

        {typeof data?.total === "number" && data.total > allProducts.length && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {tr(
              `Viser ${allProducts.length} af ${data.total} produkter.`,
              `Showing ${allProducts.length} of ${data.total} products.`
            )}
          </p>
        )}

        {allProducts.length > 5 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              aria-label={tr("Filtrér produkter", "Filter products")}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder={tr("Filtrér på navn eller varenummer…", "Filter by name or SKU…")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Package className="size-6 text-muted-foreground" />}
            title={tr("Ingen produkter endnu.", "No products yet.")}
            description={tr(
              "Produkter udfylder tilbudslinjer automatisk med pris og moms.",
              "Products autofill quote lines with price and VAT."
            )}
          />
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {products.map((p) => (
              <div key={p.id} className="group flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {p.name}
                    {!p.active && (
                      <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                        {tr("inaktiv", "inactive")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.sku ? `${p.sku} · ` : ""}
                    {formatOre(p.unitPrice, locale)}
                    {p.unit ? ` / ${p.unit}` : ""} · {tr("moms", "VAT")} {p.vatRate}%
                  </p>
                </div>
                {/* Visible on touch and on keyboard focus — hover-only controls
                    leave a destructive button that a Tab user cannot see. */}
                <button
                  onClick={() => startEdit(p)}
                  className="row-action text-muted-foreground hover:text-foreground"
                  aria-label={tr("Redigér", "Edit")}
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() =>
                    confirm.ask({
                      title: tr("Slet produkt?", "Delete product?"),
                      name: p.name,
                      description: tr(
                        "Eksisterende tilbudslinjer beholder deres pris.",
                        "Existing quote lines keep their price."
                      ),
                      onConfirm: () =>
                        deleteProduct.mutate(p.id, {
                          onError: (e) => toast.error(errorMessage(e)),
                        }),
                    })
                  }
                  className="row-action text-muted-foreground hover:text-rose-500"
                  aria-label={tr("Slet", "Delete")}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {confirm.dialog}
      </div>
    </DashboardLayout>
  );
}
