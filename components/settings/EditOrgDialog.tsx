"use client";

import { useState } from "react";
import { Loader2, Check, RefreshCw } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useRenameOrg,
  useUpdateOrgProfile,
  useVerifyOrgProfile,
  type OrgProfile,
} from "@/lib/hooks/use-team";

/**
 * Edit everything about an organization in one place.
 *
 * Both the display name and the company details live here, because from the
 * user's side they are one thing — "edit this organization". Splitting them
 * meant the edit button appeared to do nothing but rename, while the values
 * that actually reach a customer sat in a panel further down the page.
 *
 * Radix unmounts the dialog content when it closes, so every field re-seeds
 * from the server on reopen. That is why the drafts below can be plain
 * `useState` initialisers rather than an effect syncing props into state — the
 * pattern the React Compiler rejects.
 */
export default function EditOrgDialog({
  open,
  onOpenChange,
  orgId,
  orgName,
  profile,
  locale,
  onToast,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
  profile: OrgProfile | null;
  locale: string;
  onToast: (message: string, ok?: boolean) => void;
}) {
  const tr = (da: string, en: string) => (locale === "da" ? da : en);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tr("Redigér organisation", "Edit organization")}</DialogTitle>
          <DialogDescription>
            {tr(
              "Virksomhedsoplysningerne er afsenderen på jeres tilbud og ordrer.",
              "The company details are the issuer shown on your quotes and orders."
            )}
          </DialogDescription>
        </DialogHeader>

        <EditForm
          orgId={orgId}
          orgName={orgName}
          profile={profile}
          tr={tr}
          locale={locale}
          onToast={onToast}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  orgId,
  orgName,
  profile,
  tr,
  locale,
  onToast,
  onDone,
}: {
  orgId: string;
  orgName: string;
  profile: OrgProfile | null;
  tr: (da: string, en: string) => string;
  locale: string;
  onToast: (message: string, ok?: boolean) => void;
  onDone: () => void;
}) {
  const rename = useRenameOrg();
  const update = useUpdateOrgProfile();
  const verify = useVerifyOrgProfile();

  const [displayName, setDisplayName] = useState(orgName);
  const [legalName, setLegalName] = useState(profile?.legalName ?? "");
  const [cvr, setCvr] = useState(profile?.cvr ?? "");
  const [addressLine, setAddressLine] = useState(profile?.addressLine ?? "");
  const [zipCode, setZipCode] = useState(profile?.zipCode ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [countryCode, setCountryCode] = useState(profile?.countryCode ?? "DK");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [website, setWebsite] = useState(profile?.website ?? "");
  const [brandColor, setBrandColor] = useState(profile?.brandColor ?? "");
  const [saving, setSaving] = useState(false);

  const hasProfile = !!profile;
  // The two fields that make a quote a complete document.
  const incomplete = hasProfile && (!legalName.trim() || !addressLine.trim());
  const busy = saving || rename.isPending || update.isPending || verify.isPending;

  const inputClass =
    "w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none";

  async function save() {
    if (incomplete || busy) return;
    setSaving(true);
    try {
      // Name and profile live in different tables behind different endpoints,
      // so only the one that actually changed is sent.
      if (displayName.trim() && displayName.trim() !== orgName) {
        await rename.mutateAsync({ orgId, name: displayName.trim() });
      }
      if (hasProfile) {
        await update.mutateAsync({
          orgId,
          patch: {
            legalName: legalName.trim(),
            cvr: cvr.trim() || null,
            addressLine: addressLine.trim(),
            zipCode: zipCode.trim() || undefined,
            city: city.trim() || undefined,
            countryCode: countryCode.trim().toUpperCase(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            website: website.trim() || null,
            brandColor: brandColor.trim() || null,
          } as Partial<OrgProfile>,
        });
      }
      onToast(tr("Organisation opdateret", "Organization updated"));
      onDone();
    } catch (err) {
      onToast((err as Error).message, false);
    } finally {
      setSaving(false);
    }
  }

  function reverify() {
    verify.mutate(
      { orgId },
      {
        onSuccess: () => {
          onToast(tr("Opdateret fra CVR-registret", "Refreshed from the CVR registry"));
          // Close so the dialog re-seeds from the refreshed server values rather
          // than showing the pre-refresh drafts next to a "verified" badge.
          onDone();
        },
        onError: (err) => onToast((err as Error).message, false),
      }
    );
  }

  return (
    <>
      <div className="space-y-4">
        <Field label={tr("Visningsnavn i appen", "Display name in the app")}>
          <input className={inputClass} value={displayName} disabled={busy}
            onChange={(e) => setDisplayName(e.target.value)} />
          <Hint>
            {tr(
              "Kun til navigation. Tilbud bruger det juridiske navn nedenfor.",
              "Navigation only. Quotes use the legal name below."
            )}
          </Hint>
        </Field>

        {!hasProfile ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-900">
              {tr("Ingen virksomhedsprofil", "No company profile")}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {tr(
                "Denne organisation blev oprettet før profiler fandtes, så tilbud sendes uden afsenderadresse.",
                "This organization predates company profiles, so quotes are sent without an issuer address."
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <p className="text-sm font-semibold text-slate-900 mr-1">
                  {tr("Virksomhedsoplysninger", "Company details")}
                </p>
                {profile.source === "cvr" ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
                    <Check className="size-3" />
                    {tr("Bekræftet i CVR", "Verified against CVR")}
                    {profile.cvrVerifiedAt && (
                      <span className="font-normal text-emerald-600">
                        · {new Date(profile.cvrVerifiedAt).toLocaleDateString(
                          locale === "da" ? "da-DK" : "en-GB"
                        )}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-full px-2.5 py-1">
                    {tr("Indtastet manuelt", "Entered manually")}
                  </span>
                )}
                {profile.cvr && (
                  <button type="button" onClick={reverify} disabled={busy}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:underline disabled:opacity-50">
                    {verify.isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3" />
                    )}
                    {tr("Hent igen fra CVR", "Refresh from CVR")}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={`${tr("Juridisk navn", "Legal name")} *`} className="sm:col-span-2">
                  <input className={inputClass} value={legalName} disabled={busy}
                    onChange={(e) => setLegalName(e.target.value)} />
                </Field>

                <Field label={tr("CVR-nummer", "CVR number")}>
                  <input className={inputClass} value={cvr} disabled={busy} inputMode="numeric"
                    onChange={(e) => setCvr(e.target.value.replace(/\D/g, "").slice(0, 8))} />
                </Field>
                <Field label={tr("Landekode", "Country code")}>
                  <input className={inputClass} value={countryCode} disabled={busy} maxLength={2}
                    onChange={(e) => setCountryCode(e.target.value.toUpperCase())} />
                </Field>

                <Field label={`${tr("Adresse", "Address")} *`} className="sm:col-span-2">
                  <input className={inputClass} value={addressLine} disabled={busy}
                    onChange={(e) => setAddressLine(e.target.value)} />
                </Field>

                <Field label={tr("Postnummer", "Postcode")}>
                  <input className={inputClass} value={zipCode} disabled={busy}
                    onChange={(e) => setZipCode(e.target.value)} />
                </Field>
                <Field label={tr("By", "City")}>
                  <input className={inputClass} value={city} disabled={busy}
                    onChange={(e) => setCity(e.target.value)} />
                </Field>

                <Field label={tr("E-mail", "Email")}>
                  <input className={inputClass} value={email} disabled={busy}
                    onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label={tr("Telefon", "Phone")}>
                  <input className={inputClass} value={phone} disabled={busy}
                    onChange={(e) => setPhone(e.target.value)} />
                </Field>

                <Field label={tr("Hjemmeside", "Website")}>
                  <input className={inputClass} value={website} disabled={busy}
                    placeholder="fourmates.dk"
                    onChange={(e) => setWebsite(e.target.value)} />
                </Field>
                <Field label={tr("Brandfarve", "Brand colour")}>
                  <div className="flex items-center gap-2">
                    <input className={inputClass} value={brandColor} disabled={busy}
                      placeholder="#1D4ED8"
                      onChange={(e) => setBrandColor(e.target.value)} />
                    {/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(brandColor.trim()) && (
                      <span className="size-9 rounded-lg border border-slate-200 shrink-0"
                        style={{ backgroundColor: brandColor.trim() }} />
                    )}
                  </div>
                </Field>
              </div>

              <Hint>
                {tr(
                  "Manuelle rettelser fjerner CVR-bekræftelsen — brug “Hent igen fra CVR” for at bekræfte på ny.",
                  "Editing by hand drops the CVR verification — use “Refresh from CVR” to confirm again."
                )}
              </Hint>
            </div>
          </>
        )}
      </div>

      <DialogFooter className="mt-6">
        {incomplete && (
          <p className="text-[11px] text-amber-600 mr-auto self-center">
            {tr(
              "Navn og adresse er påkrævet på et tilbud.",
              "Name and address are required on a quote."
            )}
          </p>
        )}
        <button type="button" onClick={onDone} disabled={busy}
          className="px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 disabled:opacity-50">
          {tr("Annuller", "Cancel")}
        </button>
        <button type="button" onClick={save} disabled={incomplete || busy}
          className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-lg hover:scale-[1.02] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {tr("Gem", "Save")}
        </button>
      </DialogFooter>
    </>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] text-slate-400">{children}</p>;
}
