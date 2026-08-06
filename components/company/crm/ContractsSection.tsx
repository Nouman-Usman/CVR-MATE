"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileSignature, Trash2 } from "lucide-react";
import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";
import { formatDate, formatOre } from "@/lib/format";
import { parseKronerToOre } from "@/lib/money/parse";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { useConfirm } from "@/components/crm/ConfirmDialog";
import {
  useCompanyContracts,
  useCreateContract,
  useDeleteContract,
} from "@/lib/hooks/use-company-contracts";
import { card, inputCls, panelCls, primaryBtn, rowDeleteBtn, SectionHeader } from "./shared";

const EMPTY_CONTRACT = {
  title: "",
  status: "active",
  value: "",
  startDate: "",
  expiryDate: "",
  renewalNoticeDays: "30",
  autoRenew: false,
  notes: "",
};

export function ContractsSection({ vat }: { vat: string }) {
  const { tr, locale } = useTr();
  const apiError = useApiErrorMessage();
  const confirm = useConfirm();
  const { data, isLoading } = useCompanyContracts(vat);
  const createContract = useCreateContract(vat);
  const deleteContract = useDeleteContract(vat);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_CONTRACT);

  const contracts = data?.contracts ?? [];

  function submit() {
    const title = form.title.trim();
    if (!title) {
      toast.error(tr("Titel kræves", "Title is required"));
      return;
    }
    // Contract value is stored in øre; the field takes kroner as typed.
    let valueOre: number | undefined;
    if (form.value.trim()) {
      const parsed = parseKronerToOre(form.value);
      if (parsed === null) {
        toast.error(tr("Ugyldig værdi", "Invalid value"));
        return;
      }
      valueOre = parsed;
    }
    createContract.mutate(
      {
        title,
        status: form.status,
        value: valueOre,
        startDate: form.startDate || undefined,
        expiryDate: form.expiryDate || undefined,
        renewalNoticeDays: form.renewalNoticeDays ? Number(form.renewalNoticeDays) : undefined,
        autoRenew: form.autoRenew,
        notes: form.notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setForm(EMPTY_CONTRACT);
          setShowForm(false);
        },
        onError: (e) => toast.error(apiError(e)),
      }
    );
  }

  function remove(id: string, title: string) {
    confirm.ask({
      title: tr("Slet denne kontrakt?", "Delete this contract?"),
      name: title,
      description: tr("Handlingen kan ikke fortrydes.", "This cannot be undone."),
      onConfirm: () =>
        deleteContract.mutate(id, { onError: (e) => toast.error(apiError(e)) }),
    });
  }

  return (
    <div className={card}>
      <SectionHeader
        icon={FileSignature}
        title={tr("Kontrakter", "Contracts")}
        action={
          <button onClick={() => setShowForm((s) => !s)} className={primaryBtn}>
            {showForm ? tr("Luk", "Close") : tr("Ny kontrakt", "New contract")}
          </button>
        }
      />

      {showForm && (
        <div className={"mb-4 space-y-2.5 " + panelCls}>
          <input
            className={inputCls}
            placeholder={tr("Titel", "Title")}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="draft">{tr("Kladde", "Draft")}</option>
              <option value="active">{tr("Aktiv", "Active")}</option>
              <option value="renewed">{tr("Fornyet", "Renewed")}</option>
              <option value="expired">{tr("Udløbet", "Expired")}</option>
              <option value="cancelled">{tr("Annulleret", "Cancelled")}</option>
            </select>
            <input
              className={inputCls}
              inputMode="decimal"
              placeholder={tr("Værdi (DKK)", "Value (DKK)")}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="text-[11px] text-muted-foreground block">
              {tr("Start", "Start")}
              <input
                className={inputCls}
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </label>
            <label className="text-[11px] text-muted-foreground block">
              {tr("Udløb", "Expiry")}
              <input
                className={inputCls}
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
            <label className="text-[11px] text-muted-foreground block">
              {tr("Varsel (dage)", "Notice (days)")}
              <input
                className={inputCls}
                type="number"
                value={form.renewalNoticeDays}
                onChange={(e) => setForm({ ...form, renewalNoticeDays: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground pb-2">
              <input
                type="checkbox"
                className="accent-primary"
                checked={form.autoRenew}
                onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })}
              />
              {tr("Auto-forny", "Auto-renew")}
            </label>
          </div>
          <textarea
            className={inputCls + " resize-none"}
            rows={2}
            placeholder={tr("Noter", "Notes")}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="flex justify-end">
            <button onClick={submit} disabled={createContract.isPending} className={primaryBtn}>
              {tr("Gem", "Save")}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {tr("Indlæser…", "Loading…")}
        </p>
      ) : contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {tr("Ingen kontrakter endnu.", "No contracts yet.")}
        </p>
      ) : (
        <div className="space-y-2.5">
          {contracts.map((c) => (
            <div
              key={c.id}
              className={"group flex items-start justify-between gap-2 " + panelCls}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
                  <StatusBadge kind="contract" status={c.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.value != null ? formatOre(c.value, locale) : "—"}
                  {c.expiryDate
                    ? ` · ${tr("udløber", "expires")} ${formatDate(c.expiryDate, locale)}`
                    : ""}
                  {c.autoRenew ? ` · ${tr("auto-forny", "auto-renew")}` : ""}
                </p>
                {c.notes && (
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{c.notes}</p>
                )}
              </div>
              <button
                onClick={() => remove(c.id, c.title)}
                className={rowDeleteBtn}
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
  );
}
