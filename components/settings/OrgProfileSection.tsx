"use client";

import { Loader2, Check, AlertCircle, Pencil } from "lucide-react";

import { useOrgProfile, type OrgProfile } from "@/lib/hooks/use-team";

/**
 * A read-only view of the organization's issuer identity — what appears as the
 * seller on quotes and orders.
 *
 * Display only: every change goes through `EditOrgDialog`, so there is exactly
 * one place the values can be edited and one set of rules about them. Showing
 * them here matters even though they are not editable — a rep should be able to
 * see what their documents say without opening a form to find out.
 */

const PANEL = "bg-slate-50 rounded-xl p-5";

export default function OrgProfileSection({
  orgId,
  canEdit,
  locale,
  onEdit,
}: {
  orgId: string;
  canEdit: boolean;
  locale: string;
  onEdit: () => void;
}) {
  const tr = (da: string, en: string) => (locale === "da" ? da : en);
  const { data, isLoading } = useOrgProfile(orgId);
  const profile = data?.profile ?? null;

  if (isLoading) {
    return (
      <div className={PANEL}>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-5 text-slate-300 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={PANEL}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {tr("Virksomhedsoplysninger", "Company details")}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {tr(
              "Afsenderen på jeres tilbud og ordrer — ikke kun navnet i appen.",
              "The issuer shown on your quotes and orders — not just the name in the app."
            )}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={onEdit}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            <Pencil className="size-3.5" />
            {tr("Redigér", "Edit")}
          </button>
        )}
      </div>

      {!profile ? (
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
      ) : (
        <ProfileSummary profile={profile} locale={locale} tr={tr} />
      )}
    </div>
  );
}

function ProfileSummary({
  profile,
  locale,
  tr,
}: {
  profile: OrgProfile;
  locale: string;
  tr: (da: string, en: string) => string;
}) {
  const zipCity = [profile.zipCode, profile.city].filter(Boolean).join(" ");
  // The two fields without which a quote is not a complete document.
  const missing = [
    !profile.legalName?.trim() && tr("navn", "name"),
    !profile.addressLine?.trim() && tr("adresse", "address"),
  ].filter(Boolean) as string[];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {profile.source === "cvr" ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
            <Check className="size-3" />
            {tr("Bekræftet i CVR", "Verified against CVR")}
            {profile.cvrVerifiedAt && (
              <span className="font-normal text-emerald-600">
                ·{" "}
                {new Date(profile.cvrVerifiedAt).toLocaleDateString(
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
        {profile.brandColor && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-full pl-1.5 pr-2.5 py-1">
            <span
              className="size-3 rounded-full border border-slate-200"
              style={{ backgroundColor: profile.brandColor }}
            />
            {profile.brandColor}
          </span>
        )}
      </div>

      {missing.length > 0 && (
        <p className="mb-3 text-[11px] text-amber-600 flex items-start gap-1.5">
          <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
          {tr(
            `Tilbud sendes uden: ${missing.join(", ")}.`,
            `Quotes are sent without: ${missing.join(", ")}.`
          )}
        </p>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
        <Row label={tr("Juridisk navn", "Legal name")} value={profile.legalName} />
        <Row label={tr("CVR-nummer", "CVR number")} value={profile.cvr} mono />
        <Row
          label={tr("Adresse", "Address")}
          value={[profile.addressLine, zipCity].filter(Boolean).join(", ")}
        />
        <Row label={tr("Land", "Country")} value={profile.countryCode} />
        <Row label={tr("E-mail", "Email")} value={profile.email} />
        <Row label={tr("Telefon", "Phone")} value={profile.phone} mono />
        <Row label={tr("Hjemmeside", "Website")} value={profile.website} />
      </dl>
    </>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</dt>
      <dd
        className={`text-sm truncate ${
          value ? "text-slate-900" : "text-slate-300"
        } ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}
