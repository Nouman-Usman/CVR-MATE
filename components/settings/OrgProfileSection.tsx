"use client";

import { useState } from "react";
import { Loader2, Check, RefreshCw, AlertCircle } from "lucide-react";

import {
  useOrgProfile,
  useUpdateOrgProfile,
  useVerifyOrgProfile,
  type OrgProfile,
} from "@/lib/hooks/use-team";

/**
 * Read and edit the organization's issuer identity.
 *
 * These values are the seller block on every quote and order the org sends, so
 * the section says so plainly — someone editing an address here is editing a
 * customer-facing legal document, not a display preference.
 *
 * Any member can read it (they need to know what their documents say); only
 * owners and admins can change it, matching the authority to rename the org.
 */
export default function OrgProfileSection({
  orgId,
  canEdit,
  locale,
  inputClass,
  cardClass,
  onToast,
}: {
  orgId: string;
  canEdit: boolean;
  locale: string;
  inputClass: string;
  cardClass: string;
  onToast: (message: string, ok?: boolean) => void;
}) {
  const tr = (da: string, en: string) => (locale === "da" ? da : en);
  const { data, isLoading } = useOrgProfile(orgId);
  const profile = data?.profile ?? null;

  if (isLoading) {
    return (
      <div className={cardClass}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 text-slate-300 animate-spin" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={cardClass}>
        <SectionHeader tr={tr} />
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {tr("Ingen virksomhedsprofil", "No company profile")}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {tr(
                "Denne organisation blev oprettet før profiler fandtes. Tilbud sendes uden afsenderadresse, indtil den udfyldes.",
                "This organization predates company profiles. Quotes are sent without an issuer address until one is filled in."
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <SectionHeader tr={tr} />
      {/*
        Keyed on the values the server last returned, so a successful save or a
        re-verify remounts the form with fresh defaults. Seeding local state
        from a prop inside an effect would be a setState-in-effect, which the
        React Compiler rules out.
      */}
      <ProfileForm
        key={`${profile.id}:${profile.cvrVerifiedAt ?? ""}:${profile.source}`}
        orgId={orgId}
        profile={profile}
        canEdit={canEdit}
        locale={locale}
        tr={tr}
        inputClass={inputClass}
        onToast={onToast}
      />
    </div>
  );
}

function SectionHeader({ tr }: { tr: (da: string, en: string) => string }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
        {tr("Virksomhedsoplysninger", "Company details")}
      </h2>
      <p className="text-xs text-slate-400 mt-0.5">
        {tr(
          "Afsenderen på jeres tilbud og ordrer.",
          "The issuer shown on your quotes and orders."
        )}
      </p>
    </div>
  );
}

function ProfileForm({
  orgId,
  profile,
  canEdit,
  locale,
  tr,
  inputClass,
  onToast,
}: {
  orgId: string;
  profile: OrgProfile;
  canEdit: boolean;
  locale: string;
  tr: (da: string, en: string) => string;
  inputClass: string;
  onToast: (message: string, ok?: boolean) => void;
}) {
  const update = useUpdateOrgProfile();
  const verify = useVerifyOrgProfile();

  const [legalName, setLegalName] = useState(profile.legalName ?? "");
  const [cvr, setCvr] = useState(profile.cvr ?? "");
  const [addressLine, setAddressLine] = useState(profile.addressLine ?? "");
  const [zipCode, setZipCode] = useState(profile.zipCode ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [countryCode, setCountryCode] = useState(profile.countryCode ?? "DK");
  const [email, setEmail] = useState(profile.email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [brandColor, setBrandColor] = useState(profile.brandColor ?? "");

  // The two fields that make a quote a complete document.
  const incomplete = !legalName.trim() || !addressLine.trim();

  function save() {
    if (incomplete) return;
    update.mutate(
      {
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
      },
      {
        onSuccess: () => onToast(tr("Oplysninger gemt", "Details saved")),
        onError: (err) => onToast((err as Error).message, false),
      }
    );
  }

  function reverify() {
    verify.mutate(
      { orgId },
      {
        onSuccess: () =>
          onToast(tr("Opdateret fra CVR-registret", "Refreshed from the CVR registry")),
        onError: (err) => onToast((err as Error).message, false),
      }
    );
  }

  const ro = !canEdit;

  return (
    <>
      {/* Provenance. A registry-verified address and a hand-typed one are worth
          different amounts, so the difference is stated rather than implied. */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
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

        {canEdit && profile.cvr && (
          <button
            onClick={reverify}
            disabled={verify.isPending}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:underline disabled:opacity-50"
          >
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
          <input className={inputClass} value={legalName} readOnly={ro}
            onChange={(e) => setLegalName(e.target.value)} />
        </Field>

        <Field label={tr("CVR-nummer", "CVR number")}>
          <input className={inputClass} value={cvr} readOnly={ro} inputMode="numeric"
            onChange={(e) => setCvr(e.target.value.replace(/\D/g, "").slice(0, 8))} />
        </Field>
        <Field label={tr("Landekode", "Country code")}>
          <input className={inputClass} value={countryCode} readOnly={ro} maxLength={2}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase())} />
        </Field>

        <Field label={`${tr("Adresse", "Address")} *`} className="sm:col-span-2">
          <input className={inputClass} value={addressLine} readOnly={ro}
            onChange={(e) => setAddressLine(e.target.value)} />
        </Field>

        <Field label={tr("Postnummer", "Postcode")}>
          <input className={inputClass} value={zipCode} readOnly={ro}
            onChange={(e) => setZipCode(e.target.value)} />
        </Field>
        <Field label={tr("By", "City")}>
          <input className={inputClass} value={city} readOnly={ro}
            onChange={(e) => setCity(e.target.value)} />
        </Field>

        <Field label={tr("E-mail", "Email")}>
          <input className={inputClass} value={email} readOnly={ro}
            onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={tr("Telefon", "Phone")}>
          <input className={inputClass} value={phone} readOnly={ro}
            onChange={(e) => setPhone(e.target.value)} />
        </Field>

        <Field label={tr("Hjemmeside", "Website")}>
          <input className={inputClass} value={website} readOnly={ro}
            onChange={(e) => setWebsite(e.target.value)} />
        </Field>
        <Field label={tr("Brandfarve", "Brand colour")}>
          <div className="flex items-center gap-2">
            <input className={inputClass} value={brandColor} readOnly={ro} placeholder="#1D4ED8"
              onChange={(e) => setBrandColor(e.target.value)} />
            {/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(brandColor.trim()) && (
              <span
                className="size-8 rounded-lg border border-slate-200 shrink-0"
                style={{ backgroundColor: brandColor.trim() }}
              />
            )}
          </div>
        </Field>
      </div>

      {canEdit && (
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            disabled={incomplete || update.isPending}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-lg hover:scale-[1.02] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
          >
            {update.isPending && <Loader2 className="size-4 animate-spin" />}
            {tr("Gem", "Save")}
          </button>
          {incomplete && (
            <p className="text-[11px] text-amber-600">
              {tr(
                "Navn og adresse er påkrævet på et tilbud.",
                "Name and address are required on a quote."
              )}
            </p>
          )}
        </div>
      )}

      {canEdit && (
        <p className="mt-4 text-[11px] text-slate-400">
          {tr(
            "Manuelle rettelser fjerner CVR-bekræftelsen — brug “Hent igen fra CVR” for at bekræfte på ny.",
            "Editing by hand drops the CVR verification — use “Refresh from CVR” to confirm again."
          )}
        </p>
      )}
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
