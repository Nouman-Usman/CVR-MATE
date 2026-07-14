"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatDate } from "@/lib/format";
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  type Contact,
} from "@/lib/hooks/use-contacts";
import {
  useCompanyActivity,
  useCompanyNotes,
  useCreateNote,
  type ActivityItem,
} from "@/lib/hooks/use-company-crm";

type Tr = (da: string, en: string) => string;

const card = "bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6";
const sectionTitle =
  "text-sm font-bold text-slate-900 mb-4 flex items-center gap-2";
const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400";

/** The full native-CRM panel for a company: contacts, notes, activity. */
export default function CrmTab({ vat }: { vat: string }) {
  const { locale } = useLanguage();
  const tr: Tr = (da, en) => (locale === "da" ? da : en);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <div className="lg:col-span-2 space-y-4 sm:space-y-6">
        <ContactsSection vat={vat} tr={tr} />
        <NotesSection vat={vat} tr={tr} locale={locale} />
      </div>
      <div className="lg:col-span-1">
        <ActivitySection vat={vat} tr={tr} locale={locale} />
      </div>
    </div>
  );
}

// ─── Contacts ────────────────────────────────────────────────────────────────

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

function ContactsSection({ vat, tr }: { vat: string; tr: Tr }) {
  const { data, isLoading } = useContacts(vat);
  const createContact = useCreateContact(vat);
  const updateContact = useUpdateContact(vat);
  const deleteContact = useDeleteContact(vat);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const contacts = data?.contacts ?? [];

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
      .catch((e: Error) => toast.error(e.message));
  }

  function remove(c: Contact) {
    if (!confirm(tr("Slet denne kontakt?", "Delete this contact?"))) return;
    deleteContact.mutate(c.id, {
      onError: (e) => toast.error((e as Error).message),
    });
  }

  const saving = createContact.isPending || updateContact.isPending;

  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={sectionTitle + " mb-0"}>
          <span className="material-symbols-outlined text-lg text-blue-600">contacts</span>
          {tr("Kontakter", "Contacts")}
          {contacts.length > 0 && (
            <span className="text-xs font-semibold text-slate-400">({contacts.length})</span>
          )}
        </h2>
        {!showForm && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            {tr("Tilføj kontakt", "Add contact")}
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-5 p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className={inputCls}
              placeholder={tr("Navn *", "Name *")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder={tr("Titel", "Title")}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              className={inputCls}
              type="email"
              placeholder={tr("E-mail", "Email")}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder={tr("Telefon", "Phone")}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <input
              className={inputCls + " sm:col-span-2"}
              placeholder="LinkedIn URL"
              value={form.linkedinUrl}
              onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
            />
            <textarea
              className={inputCls + " sm:col-span-2 resize-none"}
              rows={2}
              placeholder={tr("Noter", "Notes")}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
              />
              {tr("Primær kontakt", "Primary contact")}
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              {tr("Retsgrundlag", "Lawful basis")}
              <select
                className="px-2 py-1 rounded-md border border-slate-200 text-xs"
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
            <button
              onClick={submit}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
            >
              {saving ? tr("Gemmer…", "Saving…") : tr("Gem", "Save")}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
            >
              {tr("Annuller", "Cancel")}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400 py-6 text-center">{tr("Indlæser…", "Loading…")}</p>
      ) : contacts.length === 0 && !showForm ? (
        <p className="text-sm text-slate-400 py-8 text-center">
          {tr("Ingen kontakter endnu.", "No contacts yet.")}
        </p>
      ) : (
        <div className="divide-y divide-slate-50">
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
    </div>
  );
}

function ContactRow({
  contact: c,
  tr,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  tr: Tr;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const initials = c.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="py-3 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white flex items-center justify-center text-xs font-bold shrink-0">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
          {c.isPrimary && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              {tr("Primær", "Primary")}
            </span>
          )}
        </div>
        {c.title && <p className="text-xs text-slate-500">{c.title}</p>}
        <div className="mt-1 flex flex-col gap-0.5">
          {c.email && (
            <a href={`mailto:${c.email}`} className="text-xs text-blue-600 hover:underline truncate">
              {c.email}
            </a>
          )}
          {c.phone && <span className="text-xs text-slate-600">{c.phone}</span>}
          {c.linkedinUrl && (
            <a
              href={c.linkedinUrl.startsWith("http") ? c.linkedinUrl : `https://${c.linkedinUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline truncate"
            >
              LinkedIn
            </a>
          )}
          {c.notes && <p className="text-xs text-slate-500 mt-1">{c.notes}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={`/api/contacts/${c.id}/export`}
          title={tr("Eksportér (GDPR)", "Export (GDPR)")}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">download</span>
        </a>
        <button
          onClick={onEdit}
          title={tr("Rediger", "Edit")}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">edit</span>
        </button>
        <button
          onClick={onDelete}
          title={tr("Slet", "Delete")}
          className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">delete</span>
        </button>
      </div>
    </div>
  );
}

// ─── Notes ───────────────────────────────────────────────────────────────────

function NotesSection({ vat, tr, locale }: { vat: string; tr: Tr; locale: string }) {
  const { data, isLoading } = useCompanyNotes(vat);
  const createNote = useCreateNote(vat);
  const [content, setContent] = useState("");

  const notes = data?.notes ?? [];

  function add() {
    const v = content.trim();
    if (!v) return;
    createNote.mutate(v, {
      onSuccess: () => setContent(""),
      onError: (e) => toast.error((e as Error).message),
    });
  }

  return (
    <div className={card}>
      <h2 className={sectionTitle}>
        <span className="material-symbols-outlined text-lg text-blue-600">sticky_note_2</span>
        {tr("Noter", "Notes")}
      </h2>
      <div className="mb-4">
        <textarea
          className={inputCls + " resize-none"}
          rows={2}
          placeholder={tr("Tilføj en note…", "Add a note…")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={add}
            disabled={createNote.isPending || !content.trim()}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {tr("Tilføj note", "Add note")}
          </button>
        </div>
      </div>
      {isLoading ? (
        <p className="text-sm text-slate-400 py-4 text-center">{tr("Indlæser…", "Loading…")}</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          {tr("Ingen noter endnu.", "No notes yet.")}
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="p-3 rounded-lg bg-slate-50/70 border border-slate-100">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.content}</p>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {n.author?.name ?? tr("Ukendt", "Unknown")} · {formatDate(n.createdAt, locale)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Activity ────────────────────────────────────────────────────────────────

const ACTION_ICON: Record<string, string> = {
  created: "add_circle",
  updated: "edit",
  deleted: "delete",
  exported: "download",
  stage_changed: "swap_horiz",
  won: "emoji_events",
  lost: "cancel",
};

function activityLabel(a: ActivityItem, tr: Tr): string {
  const entity =
    a.entityType === "contact"
      ? tr("kontakt", "contact")
      : a.entityType === "note"
        ? tr("note", "note")
        : a.entityType === "deal"
          ? tr("aftale", "deal")
          : a.entityType;
  const verb =
    a.action === "created"
      ? tr("oprettede", "created")
      : a.action === "updated"
        ? tr("opdaterede", "updated")
        : a.action === "deleted"
          ? tr("slettede", "deleted")
          : a.action === "exported"
            ? tr("eksporterede", "exported")
            : a.action === "stage_changed"
              ? tr("flyttede", "moved")
              : a.action === "won"
                ? tr("vandt", "won")
                : a.action === "lost"
                  ? tr("tabte", "lost")
                  : a.action;
  return `${verb} ${entity}`;
}

function ActivitySection({ vat, tr, locale }: { vat: string; tr: Tr; locale: string }) {
  const { data, isLoading } = useCompanyActivity(vat);
  const items = data?.activity ?? [];

  return (
    <div className={card + " lg:sticky lg:top-6"}>
      <h2 className={sectionTitle}>
        <span className="material-symbols-outlined text-lg text-blue-600">history</span>
        {tr("Aktivitet", "Activity")}
      </h2>
      {isLoading ? (
        <p className="text-sm text-slate-400 py-4 text-center">{tr("Indlæser…", "Loading…")}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          {tr("Ingen aktivitet endnu.", "No activity yet.")}
        </p>
      ) : (
        <ol className="relative border-l border-slate-100 ml-2 space-y-4">
          {items.map((a) => (
            <li key={a.id} className="ml-4">
              <span className="absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full bg-blue-50 ring-4 ring-white">
                <span className="material-symbols-outlined text-[11px] text-blue-600">
                  {ACTION_ICON[a.action] ?? "circle"}
                </span>
              </span>
              <p className="text-xs text-slate-700">
                <span className="font-semibold">{a.actor?.name ?? tr("System", "System")}</span>{" "}
                {activityLabel(a, tr)}
                {typeof a.metadata?.name === "string" ? ` · ${a.metadata.name}` : ""}
              </p>
              <p className="text-[11px] text-slate-400">{formatDate(a.createdAt, locale)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
