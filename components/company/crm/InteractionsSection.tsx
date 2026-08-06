"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Flag, MessagesSquare, Trash2 } from "lucide-react";
import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";
import { formatDate } from "@/lib/format";
import { useConfirm } from "@/components/crm/ConfirmDialog";
import {
  useCompanyInteractions,
  useCreateInteraction,
  useDeleteInteraction,
  type CreateInteractionInput,
} from "@/lib/hooks/use-company-crm";
import {
  card,
  Field,
  inputCls,
  panelCls,
  primaryBtn,
  rowDeleteBtn,
  SectionHeader,
  TYPE_ICON,
  typeLabel,
} from "./shared";

const EMPTY_INTERACTION = {
  type: "meeting",
  direction: "outbound",
  occurredAt: "",
  subject: "",
  body: "",
  topics: "",
  nextStep: "",
  nextStepAt: "",
};

export function InteractionsSection({ vat }: { vat: string }) {
  const { tr, locale } = useTr();
  const apiError = useApiErrorMessage();
  const confirm = useConfirm();
  const { data, isLoading } = useCompanyInteractions(vat);
  const createInteraction = useCreateInteraction(vat);
  const deleteInteraction = useDeleteInteraction(vat);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_INTERACTION);

  const items = data?.interactions ?? [];

  function submit() {
    const topics = form.topics
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload: CreateInteractionInput = {
      type: form.type as CreateInteractionInput["type"],
      direction: form.direction as CreateInteractionInput["direction"],
      occurredAt: form.occurredAt || undefined,
      subject: form.subject.trim() || undefined,
      body: form.body.trim() || undefined,
      topics: topics.length ? topics : undefined,
      nextStep: form.nextStep.trim() || undefined,
      nextStepAt: form.nextStepAt || undefined,
    };
    createInteraction.mutate(payload, {
      onSuccess: () => {
        setForm(EMPTY_INTERACTION);
        setShowForm(false);
      },
      onError: (e) => toast.error(apiError(e)),
    });
  }

  function remove(id: string, name: string) {
    confirm.ask({
      title: tr("Slet denne interaktion?", "Delete this interaction?"),
      name,
      description: tr("Handlingen kan ikke fortrydes.", "This cannot be undone."),
      onConfirm: () =>
        deleteInteraction.mutate(id, { onError: (e) => toast.error(apiError(e)) }),
    });
  }

  return (
    <div className={card}>
      <SectionHeader
        icon={MessagesSquare}
        title={tr("Interaktioner", "Interactions")}
        action={
          <button onClick={() => setShowForm((s) => !s)} className={primaryBtn}>
            {showForm ? tr("Luk", "Close") : tr("Log interaktion", "Log interaction")}
          </button>
        }
      />

      {showForm && (
        <div className={"mb-4 space-y-2.5 " + panelCls}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Field label={tr("Type", "Type")}>
              <select
                className={inputCls}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="meeting">{tr("Møde", "Meeting")}</option>
                <option value="visit">{tr("Besøg", "Visit")}</option>
                <option value="call">{tr("Opkald", "Call")}</option>
                <option value="email">{tr("E-mail", "Email")}</option>
                <option value="note">{tr("Notat", "Note")}</option>
              </select>
            </Field>
            <Field label={tr("Retning", "Direction")}>
              <select
                className={inputCls}
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value })}
              >
                <option value="outbound">{tr("Udgående", "Outbound")}</option>
                <option value="inbound">{tr("Indgående", "Inbound")}</option>
                <option value="internal">{tr("Intern", "Internal")}</option>
              </select>
            </Field>
            {/* Labelled explicitly: this form has a second date field, and
                "date input" alone does not say which one you are on. */}
            <Field label={tr("Fandt sted", "Occurred on")}>
              <input
                type="date"
                className={inputCls}
                value={form.occurredAt}
                onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
              />
            </Field>
          </div>
          <Field label={tr("Emne", "Subject")}>
            <input
              className={inputCls}
              placeholder={tr("Emne", "Subject")}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </Field>
          <Field label={tr("Referat", "Summary")}>
            <textarea
              className={inputCls + " resize-none"}
              rows={2}
              placeholder={tr("Hvad blev drøftet…", "What was discussed…")}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </Field>
          <Field label={tr("Emner", "Topics")} hint={tr("(komma-adskilt)", "(comma-separated)")}>
            <input
              className={inputCls}
              placeholder={tr("Pris, levering", "Pricing, delivery")}
              value={form.topics}
              onChange={(e) => setForm({ ...form, topics: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label={tr("Næste skridt", "Next step")}>
              <input
                className={inputCls}
                placeholder={tr("Send tilbud", "Send a quote")}
                value={form.nextStep}
                onChange={(e) => setForm({ ...form, nextStep: e.target.value })}
              />
            </Field>
            <Field label={tr("Næste skridt senest", "Next step due")}>
              <input
                type="date"
                className={inputCls}
                value={form.nextStepAt}
                onChange={(e) => setForm({ ...form, nextStepAt: e.target.value })}
              />
            </Field>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {tr(
              "Et næste skridt opretter en opfølgningsopgave.",
              "A next step creates a follow-up task."
            )}
          </p>
          <div className="flex justify-end">
            <button onClick={submit} disabled={createInteraction.isPending} className={primaryBtn}>
              {tr("Gem", "Save")}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {tr("Indlæser…", "Loading…")}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {tr("Ingen interaktioner endnu.", "No interactions yet.")}
        </p>
      ) : (
        <ol className="relative border-l border-border ml-2 space-y-4">
          {items.map((i) => {
            const Icon = TYPE_ICON[i.type] ?? MessagesSquare;
            return (
              <li key={i.id} className="ml-4 group">
                <span className="absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 ring-4 ring-card">
                  <Icon className="size-2.5 text-primary" />
                </span>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {typeLabel(i.type, tr)}
                      {i.subject ? (
                        <span className="font-normal text-muted-foreground"> · {i.subject}</span>
                      ) : null}
                    </p>
                    {i.body && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">
                        {i.body}
                      </p>
                    )}
                    {i.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {i.topics.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {i.nextStep && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-md px-2 py-1 mt-1.5 inline-flex items-center gap-1">
                        <Flag className="size-3" />
                        {tr("Næste", "Next")}: {i.nextStep}
                        {i.nextStepAt ? ` · ${formatDate(i.nextStepAt, locale)}` : ""}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {formatDate(i.occurredAt, locale)}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(i.id, i.subject || typeLabel(i.type, tr))}
                    className={rowDeleteBtn}
                    aria-label={tr("Slet", "Delete")}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {confirm.dialog}
    </div>
  );
}
