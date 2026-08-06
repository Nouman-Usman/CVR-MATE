"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";
import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";
import { useConfirm } from "@/components/crm/ConfirmDialog";
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  type Contact,
} from "@/lib/hooks/use-contacts";
import { card, Field, inputCls, primaryBtn, subtleBtn, SectionHeader } from "./shared";
import { ContactRow } from "./ContactRow";

const EMPTY_FORM = {
  name: "",
  title: "",
  email: "",
  phone: "",
  linkedinUrl: "",
  notes: "",
  isPrimary: false,
  lawfulBasis: "legitimate_interest",
};

export function ContactsSection({ vat }: { vat: string }) {
  const { tr } = useTr();
  const apiError = useApiErrorMessage();
  const confirm = useConfirm();
  const { data, isLoading } = useContacts(vat);
  const createContact = useCreateContact(vat);
  const updateContact = useUpdateContact(vat);
  const deleteContact = useDeleteContact(vat);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const nameRef = useRef<HTMLInputElement>(null);

  const contacts = data?.contacts ?? [];

  // The form renders above the list, so pressing "edit" on the fifth contact
  // opened a panel off-screen and left focus on the pencil. Re-runs on the
  // contact id too, so switching rows while the form is already open moves
  // focus again rather than silently swapping the values underneath you.
  useEffect(() => {
    if (showForm) nameRef.current?.focus();
  }, [showForm, editing?.id]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }
  function openEdit(c: Contact) {
    setEditing(c);
    setForm({
      name: c.name,
      title: c.title ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      linkedinUrl: c.linkedinUrl ?? "",
      notes: c.notes ?? "",
      isPrimary: c.isPrimary,
      lawfulBasis: c.lawfulBasis,
    });
    setShowForm(true);
  }

  function submit() {
    if (!form.name.trim()) {
      toast.error(tr("Navn er påkrævet", "Name is required"));
      return;
    }
    const mutation = editing
      ? updateContact.mutateAsync({ id: editing.id, ...form })
      : createContact.mutateAsync(form);
    mutation
      .then(() => {
        setShowForm(false);
        setEditing(null);
        setForm({ ...EMPTY_FORM });
      })
      .catch((e: unknown) => toast.error(apiError(e)));
  }

  function remove(c: Contact) {
    confirm.ask({
      title: tr("Slet denne kontakt?", "Delete this contact?"),
      name: c.name,
      description: tr("Handlingen kan ikke fortrydes.", "This cannot be undone."),
      onConfirm: () =>
        deleteContact.mutate(c.id, {
          onError: (e) => toast.error(apiError(e)),
        }),
    });
  }

  const saving = createContact.isPending || updateContact.isPending;

  return (
    <div className={card}>
      <SectionHeader
        icon={Users}
        title={tr("Kontakter", "Contacts")}
        count={contacts.length}
        action={
          !showForm && (
            <button onClick={openCreate} className={primaryBtn + " flex items-center gap-1.5"}>
              <Plus className="size-3.5" />
              {tr("Tilføj kontakt", "Add contact")}
            </button>
          )
        }
      />

      {showForm && (
        <div className="mb-5 p-4 rounded-xl border border-border bg-muted/50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={tr("Navn", "Name")} hint="*">
              <input
                ref={nameRef}
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label={tr("Titel", "Title")}>
              <input
                className={inputCls}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label={tr("E-mail", "Email")}>
              <input
                className={inputCls}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label={tr("Telefon", "Phone")}>
              <input
                className={inputCls}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="LinkedIn URL" className="sm:col-span-2">
              <input
                className={inputCls}
                value={form.linkedinUrl}
                onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
              />
            </Field>
            <Field label={tr("Noter", "Notes")} className="sm:col-span-2">
              <textarea
                className={inputCls + " resize-none"}
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                className="accent-primary"
                checked={form.isPrimary}
                onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
              />
              {tr("Primær kontakt", "Primary contact")}
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {tr("Retsgrundlag", "Lawful basis")}
              <select
                className="px-2 py-1 rounded-md border border-border bg-background text-foreground text-xs"
                value={form.lawfulBasis}
                onChange={(e) => setForm({ ...form, lawfulBasis: e.target.value })}
              >
                <option value="legitimate_interest">
                  {tr("Legitim interesse", "Legitimate interest")}
                </option>
                <option value="consent">{tr("Samtykke", "Consent")}</option>
                <option value="contract">{tr("Kontrakt", "Contract")}</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={submit} disabled={saving} className={primaryBtn + " px-4"}>
              {saving ? tr("Gemmer…", "Saving…") : tr("Gem", "Save")}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className={subtleBtn}
            >
              {tr("Annuller", "Cancel")}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {tr("Indlæser…", "Loading…")}
        </p>
      ) : contacts.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {tr("Ingen kontakter endnu.", "No contacts yet.")}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {contacts.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              tr={tr}
              onEdit={() => openEdit(c)}
              onDelete={() => remove(c)}
            />
          ))}
        </div>
      )}

      {confirm.dialog}
    </div>
  );
}
