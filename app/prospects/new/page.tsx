"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  X,
  Plus,
  Trash2,
  Loader2,
  Building2,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/language-context";
import { useSuggestions } from "@/lib/hooks/use-suggestions";
import { useCompany } from "@/lib/hooks/use-company";
import { flattenCompany } from "@/lib/cvr-client";
import {
  useCreateProspect,
  type WorkspaceStatus,
  type ProspectContactInput,
} from "@/lib/hooks/use-create-prospect";

interface PickedCompany {
  vat: string;
  name: string;
  city?: string | null;
}

interface ContactDraft {
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

const emptyContact = (isPrimary = false): ContactDraft => ({
  name: "",
  title: "",
  email: "",
  phone: "",
  isPrimary,
});

export default function NewProspectPage() {
  const { locale } = useLanguage();
  const tr = (da: string, en: string) => (locale === "da" ? da : en);
  const router = useRouter();
  const createProspect = useCreateProspect();

  // ─── Company picker ────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [picked, setPicked] = useState<PickedCompany | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: suggestions, isFetching: searching } = useSuggestions(debouncedQuery);
  const isCvr = /^\d{8}$/.test(debouncedQuery);

  // Full CVR detail for the preview card once a company is picked.
  const { data: companyData, isFetching: loadingCompany } = useCompany(picked?.vat);
  const preview = useMemo(
    () => (companyData?.company ? flattenCompany(companyData.company) : null),
    [companyData]
  );

  // ─── Details ───────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<WorkspaceStatus>("prospect");
  const [tagsInput, setTagsInput] = useState("");
  const [save, setSave] = useState(true);
  const [note, setNote] = useState("");
  const [contacts, setContacts] = useState<ContactDraft[]>([emptyContact(true)]);

  function pick(company: PickedCompany) {
    setPicked(company);
    setQuery("");
    setDebouncedQuery("");
  }

  function updateContact(i: number, patch: Partial<ContactDraft>) {
    setContacts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function setPrimary(i: number) {
    setContacts((prev) => prev.map((c, idx) => ({ ...c, isPrimary: idx === i })));
  }

  function removeContact(i: number) {
    setContacts((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      if (next.length === 0) return [emptyContact(true)];
      // Keep exactly one primary.
      if (!next.some((c) => c.isPrimary)) next[0].isPrimary = true;
      return next;
    });
  }

  const tags = useMemo(
    () =>
      tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsInput]
  );

  function submit() {
    if (!picked) {
      toast.error(tr("Vælg en virksomhed", "Select a company"));
      return;
    }
    // Only contacts with a name are sent; e-mail/phone are optional.
    const namedContacts = contacts.filter((c) => c.name.trim());
    const payloadContacts: ProspectContactInput[] = namedContacts.map((c) => ({
      name: c.name.trim(),
      title: c.title.trim() || undefined,
      email: c.email.trim() || undefined,
      phone: c.phone.trim() || undefined,
      isPrimary: c.isPrimary,
    }));

    createProspect.mutate(
      {
        vat: picked.vat,
        status,
        tags: tags.length ? tags : undefined,
        save,
        note: save && note.trim() ? note.trim() : undefined,
        contacts: payloadContacts.length ? payloadContacts : undefined,
      },
      {
        onSuccess: (data) => {
          const parts = [
            data.workspaceCreated
              ? tr("Prospect oprettet", "Prospect created")
              : tr("Prospect opdateret", "Prospect updated"),
          ];
          if (data.contacts.length)
            parts.push(
              tr(
                `${data.contacts.length} kontakt(er) tilføjet`,
                `${data.contacts.length} contact(s) added`
              )
            );
          if (data.skippedContacts.length)
            parts.push(
              tr(
                `${data.skippedContacts.length} dublet sprunget over`,
                `${data.skippedContacts.length} duplicate(s) skipped`
              )
            );
          toast.success(parts.join(" · "));
          router.push(`/company/${data.vat}`);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  const submitting = createProspect.isPending;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <UserPlus className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {tr("Ny prospect", "New prospect")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tr(
                "Indtast et CVR-nummer, tilføj kontakter, og gem til dit workspace.",
                "Enter a CVR number, add contacts, and save to your workspace."
              )}
            </p>
          </div>
        </div>

        {/* ─── Step 1: company ─────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {tr("Virksomhed", "Company")}
          </h2>

          {picked ? (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-start justify-between gap-2 bg-primary/5 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {preview?.name || picked.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    CVR {picked.vat}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPicked(null)}
                  aria-label={tr("Skift virksomhed", "Change company")}
                >
                  <X />
                </Button>
              </div>
              <div className="px-4 py-3">
                {loadingCompany ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    {tr("Henter virksomhedsdata…", "Loading company data…")}
                  </p>
                ) : preview ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <Field label={tr("Branche", "Industry")} value={preview.industry} />
                    <Field label={tr("Status", "Status")} value={preview.status} />
                    <Field
                      label={tr("By", "City")}
                      value={[preview.zipcode, preview.city].filter(Boolean).join(" ")}
                    />
                    <Field label={tr("Ansatte", "Employees")} value={preview.employees} />
                    <Field
                      label={tr("Adresse", "Address")}
                      value={preview.street}
                      full
                    />
                  </dl>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {tr("Ingen ekstra data.", "No additional data.")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  autoFocus
                  className="pl-8"
                  placeholder={tr(
                    "Søg navn eller indsæt 8-cifret CVR…",
                    "Search name or paste 8-digit CVR…"
                  )}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {(isCvr || debouncedQuery.length >= 2) && (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {isCvr && (
                    <button
                      onClick={() => pick({ vat: debouncedQuery, name: `CVR ${debouncedQuery}` })}
                      className="w-full flex items-center gap-2 text-left px-3 py-2.5 hover:bg-muted transition-colors"
                    >
                      <Building2 className="size-4 text-primary shrink-0" />
                      <span className="text-sm font-medium text-foreground">
                        {tr(`Brug CVR ${debouncedQuery}`, `Use CVR ${debouncedQuery}`)}
                      </span>
                      <ArrowRight className="size-3.5 text-muted-foreground ml-auto" />
                    </button>
                  )}
                  {!isCvr && searching && (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      {tr("Søger…", "Searching…")}
                    </p>
                  )}
                  {!isCvr &&
                    !searching &&
                    debouncedQuery.length >= 2 &&
                    suggestions?.results.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        {tr("Ingen resultater", "No results")}
                      </p>
                    )}
                  {!isCvr &&
                    suggestions?.results.map((r) => (
                      <button
                        key={r.vat}
                        onClick={() =>
                          pick({
                            vat: String(r.vat),
                            name: r.life?.name || `CVR ${r.vat}`,
                            city: r.address?.cityname,
                          })
                        }
                        className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                      >
                        <p className="text-sm font-medium text-foreground truncate">
                          {r.life?.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          CVR {r.vat}
                          {r.address?.cityname ? ` · ${r.address.cityname}` : ""}
                        </p>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ─── Step 2: details ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {tr("Detaljer", "Details")}
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{tr("Stadie", "Stage")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as WorkspaceStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">{tr("Prospect", "Prospect")}</SelectItem>
                  <SelectItem value="lead">{tr("Lead", "Lead")}</SelectItem>
                  <SelectItem value="qualified">{tr("Kvalificeret", "Qualified")}</SelectItem>
                  <SelectItem value="customer">{tr("Kunde", "Customer")}</SelectItem>
                  <SelectItem value="churned">{tr("Mistet", "Churned")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Tags (komma-adskilt)", "Tags (comma-separated)")}</Label>
              <Input
                placeholder={tr("f.eks. VIP, Q3", "e.g. VIP, Q3")}
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={save} onCheckedChange={(v) => setSave(v === true)} />
            <span className="text-sm text-foreground">
              {tr("Gem også til Gemte virksomheder", "Also save to Saved companies")}
            </span>
          </label>
          {save && (
            <Textarea
              placeholder={tr("Note (valgfri)", "Note (optional)")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          )}
        </section>

        {/* ─── Step 3: contacts ────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {tr("Kontakter", "Contacts")}
          </h2>

          <div className="space-y-3">
            {contacts.map((c, i) => (
              <div key={i} className="rounded-xl border border-border p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {tr("Kontakt", "Contact")} {i + 1}
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                      <Checkbox
                        checked={c.isPrimary}
                        onCheckedChange={() => setPrimary(i)}
                      />
                      {tr("Primær", "Primary")}
                    </label>
                    {contacts.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeContact(i)}
                        aria-label={tr("Fjern kontakt", "Remove contact")}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <Input
                    placeholder={tr("Navn *", "Name *")}
                    value={c.name}
                    onChange={(e) => updateContact(i, { name: e.target.value })}
                  />
                  <Input
                    placeholder={tr("Titel", "Title")}
                    value={c.title}
                    onChange={(e) => updateContact(i, { title: e.target.value })}
                  />
                  <Input
                    type="email"
                    placeholder={tr("E-mail", "Email")}
                    value={c.email}
                    onChange={(e) => updateContact(i, { email: e.target.value })}
                  />
                  <Input
                    placeholder={tr("Telefon", "Phone")}
                    value={c.phone}
                    onChange={(e) => updateContact(i, { phone: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setContacts((prev) => [...prev, emptyContact()])}
          >
            <Plus />
            {tr("Tilføj kontakt", "Add contact")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {tr(
              "Kontakter uden navn ignoreres. Retsgrundlag: legitim interesse.",
              "Contacts without a name are ignored. Lawful basis: legitimate interest."
            )}
          </p>
        </section>

        {/* ─── Submit ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={() => router.back()} disabled={submitting}>
            {tr("Annullér", "Cancel")}
          </Button>
          <Button variant="gradient" onClick={submit} disabled={!picked || submitting}>
            {submitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <UserPlus />
            )}
            {tr("Opret prospect", "Create prospect")}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Field({
  label,
  value,
  full,
}: {
  label: string;
  value?: string | null;
  full?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
        {label}
      </dt>
      <dd className="text-foreground truncate">{value}</dd>
    </div>
  );
}
