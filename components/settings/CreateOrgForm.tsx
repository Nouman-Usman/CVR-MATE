"use client";

import { useState } from "react";
import { Loader2, Search, Check, AlertCircle } from "lucide-react";

import { useCreateOrg, type OrgProfileInput } from "@/lib/hooks/use-team";

/**
 * Create an organization, CVR first.
 *
 * The org profile is the issuer identity printed on every quote and order the
 * org sends, so it is collected here rather than left for later — an org
 * created without one issues documents with no address, which is the state this
 * form exists to prevent.
 *
 * CVR first because typing eight digits is faster and more accurate than typing
 * an address, and the registry this whole product is built on already knows it.
 * The manual path stays available for foreign entities, sole traders without a
 * Danish CVR, and the days the registry is unreachable.
 */

interface LookupResult {
  companyName?: string;
  addressLine?: string;
  zipCode?: string;
  city?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export default function CreateOrgForm({
  locale,
  inputClass,
  onCreated,
  onError,
}: {
  locale: string;
  inputClass: string;
  onCreated: (message: string) => void;
  onError: (message: string) => void;
}) {
  const tr = (da: string, en: string) => (locale === "da" ? da : en);
  const createOrg = useCreateOrg();

  const [mode, setMode] = useState<"lookup" | "details">("lookup");
  const [cvr, setCvr] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  // Tracks whether the details on screen actually came back from the registry.
  // The server re-verifies before trusting it, but sending an honest claim
  // means the two agree in the normal case.
  const [source, setSource] = useState<"cvr" | "manual">("manual");

  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");

  const cvrValid = /^\d{8}$/.test(cvr.trim());
  // The two fields that make a document legally complete. Everything else is
  // optional, and the button says so by staying disabled until these exist.
  const canCreate = legalName.trim().length > 0 && addressLine.trim().length > 0;

  async function runLookup() {
    if (!cvrValid) return;
    setLooking(true);
    setLookupFailed(false);
    try {
      const res = await fetch("/api/brand/cvr-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat: cvr.trim() }),
      });
      if (!res.ok) {
        setLookupFailed(true);
        return;
      }
      const data: LookupResult = await res.json();
      setLegalName(data.companyName ?? "");
      setDisplayName(data.companyName ?? "");
      setAddressLine(data.addressLine ?? "");
      setZipCode(data.zipCode ?? "");
      setCity(data.city ?? "");
      setEmail(data.email ?? "");
      setPhone(data.phone ?? "");
      setWebsite(data.website ?? "");
      setSource("cvr");
      setMode("details");
    } catch {
      setLookupFailed(true);
    } finally {
      setLooking(false);
    }
  }

  function startManual() {
    setSource("manual");
    setMode("details");
  }

  function submit() {
    if (!canCreate) return;
    const profile: OrgProfileInput = {
      legalName: legalName.trim(),
      cvr: cvrValid ? cvr.trim() : undefined,
      addressLine: addressLine.trim(),
      zipCode: zipCode.trim() || undefined,
      city: city.trim() || undefined,
      countryCode: "DK",
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      website: website.trim() || undefined,
      source: source === "cvr" && cvrValid ? "cvr" : "manual",
    };
    createOrg.mutate(
      { name: (displayName.trim() || legalName.trim()), profile },
      {
        onSuccess: () => onCreated(tr("Organisation oprettet", "Organization created")),
        onError: (err) => onError((err as Error).message),
      }
    );
  }

  const label = "block text-xs font-semibold text-slate-500 mb-1.5";

  if (mode === "lookup") {
    return (
      <div className="bg-slate-50 rounded-xl p-6">
        <p className="text-sm font-semibold text-slate-900 mb-1">
          {tr("Opret organisation", "Create organization")}
        </p>
        <p className="text-xs text-slate-400 mb-5">
          {tr(
            "Indtast jeres CVR-nummer — vi henter navn og adresse fra registret. Oplysningerne står på jeres tilbud.",
            "Enter your CVR number — we fetch the name and address from the registry. These details appear on your quotes."
          )}
        </p>

        <div className="flex gap-2">
          <input
            className={`flex-1 ${inputClass}`}
            placeholder={tr("8-cifret CVR-nummer", "8-digit CVR number")}
            value={cvr}
            inputMode="numeric"
            onChange={(e) => setCvr(e.target.value.replace(/\D/g, "").slice(0, 8))}
            onKeyDown={(e) => e.key === "Enter" && cvrValid && runLookup()}
          />
          <button
            onClick={runLookup}
            disabled={!cvrValid || looking}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-lg hover:scale-[1.02] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shrink-0 flex items-center gap-2"
          >
            {looking ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {tr("Slå op", "Look up")}
          </button>
        </div>

        {lookupFailed && (
          <p className="mt-3 text-xs text-amber-600 flex items-start gap-1.5">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            {tr(
              "Vi kunne ikke finde det CVR-nummer. Tjek nummeret, eller indtast oplysningerne manuelt.",
              "We couldn't find that CVR number. Check it, or enter the details manually."
            )}
          </p>
        )}

        <button
          onClick={startManual}
          className="mt-4 text-xs font-semibold text-blue-600 hover:underline"
        >
          {tr("Intet dansk CVR? Indtast manuelt", "No Danish CVR? Enter details manually")}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-xl p-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {tr("Bekræft virksomhedsoplysninger", "Confirm company details")}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {tr(
              "Sådan står afsenderen på jeres tilbud og ordrer.",
              "This is how the issuer appears on your quotes and orders."
            )}
          </p>
        </div>
        {source === "cvr" && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
            <Check className="size-3" />
            {tr("Fra CVR-registret", "From CVR registry")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={label}>
            {tr("Juridisk navn", "Legal name")} <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder={tr("Fourmates ApS", "Fourmates ApS")}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={label}>
            {tr("Adresse", "Address")} <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            placeholder={tr("Gadenavn 1", "Street name 1")}
          />
        </div>

        <div>
          <label className={label}>{tr("Postnummer", "Postcode")}</label>
          <input className={inputClass} value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
        </div>
        <div>
          <label className={label}>{tr("By", "City")}</label>
          <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
        </div>

        <div>
          <label className={label}>{tr("E-mail", "Email")}</label>
          <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className={label}>{tr("Telefon", "Phone")}</label>
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="sm:col-span-2">
          <label className={label}>{tr("Hjemmeside", "Website")}</label>
          <input className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        <div className="sm:col-span-2">
          <label className={label}>
            {tr("Visningsnavn i appen", "Display name in the app")}
          </label>
          <input
            className={inputClass}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={legalName || tr("Samme som juridisk navn", "Same as legal name")}
          />
          <p className="mt-1.5 text-[11px] text-slate-400">
            {tr(
              "Kun til navigation. Tilbud bruger altid det juridiske navn.",
              "Navigation only. Quotes always use the legal name."
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-5">
        <button
          onClick={submit}
          disabled={!canCreate || createOrg.isPending}
          className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-lg hover:scale-[1.02] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
        >
          {createOrg.isPending && <Loader2 className="size-4 animate-spin" />}
          {tr("Opret organisation", "Create organization")}
        </button>
        <button
          onClick={() => setMode("lookup")}
          className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          {tr("Tilbage", "Back")}
        </button>
      </div>

      {!canCreate && (
        <p className="mt-3 text-[11px] text-slate-400">
          {tr(
            "Navn og adresse er påkrævet — uden dem er et tilbud ikke et fuldstændigt dokument.",
            "Name and address are required — without them a quote is not a complete document."
          )}
        </p>
      )}
    </div>
  );
}
