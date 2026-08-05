"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, X } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatOre } from "@/lib/format";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  type Product,
} from "@/lib/hooks/use-products";

function dkkToOre(s: string): number {
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function oreToDkk(ore: number): string {
  return (ore / 100).toString();
}

const EMPTY = { name: "", sku: "", unit: "", price: "", vatRate: "25", active: true };

export default function ProductsPage() {
  const { locale } = useLanguage();
  const tr = (da: string, en: string) => (locale === "da" ? da : en);
  const { data, isLoading } = useProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const products = data?.products ?? [];

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      unit: p.unit ?? "",
      price: oreToDkk(p.unitPrice),
      vatRate: p.vatRate,
      active: p.active,
    });
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
    const body = {
      name: form.name.trim(),
      sku: form.sku.trim() || undefined,
      unit: form.unit.trim() || undefined,
      unitPrice: dkkToOre(form.price),
      vatRate: Number(form.vatRate) || 0,
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
        <div className="rounded-xl border border-border p-4 space-y-3">
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
            <input
              className={inputCls}
              placeholder={tr("Navn", "Name")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder={tr("SKU (valgfri)", "SKU (optional)")}
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder={tr("Enhedspris (DKK)", "Unit price (DKK)")}
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder={tr("Moms %", "VAT %")}
              inputMode="decimal"
              value={form.vatRate}
              onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder={tr("Enhed (stk, time…)", "Unit (pcs, hour…)")}
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
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

        {/* List */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {tr("Indlæser…", "Loading…")}
          </p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {tr("Ingen produkter endnu.", "No products yet.")}
          </p>
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
                <button
                  onClick={() => startEdit(p)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                  aria-label={tr("Redigér", "Edit")}
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() =>
                    deleteProduct.mutate(p.id, {
                      onError: (e) => toast.error((e as Error).message),
                    })
                  }
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500"
                  aria-label={tr("Slet", "Delete")}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
