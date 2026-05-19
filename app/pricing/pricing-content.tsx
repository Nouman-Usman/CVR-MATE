"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { PLAN_LIMITS } from "@/lib/stripe/plans";

// ─── Types ────────────────────────────────────────────────────────────────────

type Interval = "monthly" | "annual";

interface PlanConfig {
  id: string;
  monthlyPrice: number;
  annualPrice: number;
  annualTotal: number;
  featured: boolean;
  enterprise: boolean;
}

// ─── Plan data ────────────────────────────────────────────────────────────────

const PLAN_CONFIGS: PlanConfig[] = [
  { id: "free",         monthlyPrice: 0,    annualPrice: 0,    annualTotal: 0,     featured: false, enterprise: false },
  { id: "starter",      monthlyPrice: 299,  annualPrice: 239,  annualTotal: 2868,  featured: false, enterprise: false },
  { id: "professional", monthlyPrice: 699,  annualPrice: 559,  annualTotal: 6708,  featured: true,  enterprise: false },
  { id: "enterprise",   monthlyPrice: 1699, annualPrice: 1359, annualTotal: 16308, featured: false, enterprise: true  },
];

// ─── Comparison table ─────────────────────────────────────────────────────────

type CellValue = number | boolean | "unlimited" | "—";

interface FeatureRow {
  da: string;
  en: string;
  values: [CellValue, CellValue, CellValue, CellValue]; // free|starter|pro|enterprise
  highlight?: boolean;
}

interface FeatureGroup {
  da: string;
  en: string;
  rows: FeatureRow[];
}

function fmt(v: CellValue, locale: string): React.ReactNode {
  if (v === "unlimited") return <span className="text-cyan-400 font-semibold text-xs">{locale === "da" ? "Ubegr." : "Unlim."}</span>;
  if (v === "—") return <span className="text-slate-600">—</span>;
  if (v === true) return <Check className="size-4 text-cyan-400 mx-auto" />;
  if (v === false) return <Minus className="size-3.5 text-slate-700 mx-auto" />;
  return <span className="tabular-nums">{v.toLocaleString()}</span>;
}

const lim = PLAN_LIMITS;

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    da: "Søgning & data",
    en: "Search & data",
    rows: [
      { da: "Virksomhedssøgninger/md", en: "Company searches/mo", values: [lim.free.companySearchesPerMonth, lim.starter.companySearchesPerMonth, lim.professional.companySearchesPerMonth, "unlimited"] },
      { da: "Gemte virksomheder", en: "Saved companies", values: [lim.free.savedCompanies, lim.starter.savedCompanies, lim.professional.savedCompanies, "unlimited"] },
      { da: "AI-brug/md", en: "AI usages/mo", values: [lim.free.aiUsagesPerMonth, lim.starter.aiUsagesPerMonth, lim.professional.aiUsagesPerMonth, "unlimited"] },
      { da: "Berigelses-opslag/md", en: "Enrichment lookups/mo", values: [lim.free.enrichmentsPerMonth, lim.starter.enrichmentsPerMonth, lim.professional.enrichmentsPerMonth, "unlimited"] },
    ],
  },
  {
    da: "Outreach & eksport",
    en: "Outreach & export",
    rows: [
      { da: "E-mail-udkast/md", en: "Email drafts/mo", values: [lim.free.emailDraftsPerMonth, lim.starter.emailDraftsPerMonth, lim.professional.emailDraftsPerMonth, "unlimited"] },
      { da: "LinkedIn-udkast/md", en: "LinkedIn drafts/mo", values: [lim.free.linkedinDraftsPerMonth, lim.starter.linkedinDraftsPerMonth, lim.professional.linkedinDraftsPerMonth, "unlimited"] },
      { da: "Eksporter/md", en: "Exports/mo", values: [lim.free.exportsPerMonth, lim.starter.exportsPerMonth, lim.professional.exportsPerMonth, "unlimited"] },
      { da: "Bulk CRM-push/md", en: "Bulk CRM push/mo", values: ["—", "—", lim.professional.bulkPushPerMonth, "unlimited"] },
    ],
  },
  {
    da: "Automatisering",
    en: "Automation",
    rows: [
      { da: "Lead triggers", en: "Lead triggers", values: [lim.free.triggers, lim.starter.triggers, lim.professional.triggers, lim.enterprise.triggers] },
      { da: "Overvågede kontakter", en: "Monitored contacts", values: [lim.free.followedPeople, lim.starter.followedPeople, lim.professional.followedPeople, lim.enterprise.followedPeople] },
      { da: "AI opgaveforslag/md", en: "AI task suggestions/mo", values: [lim.free.aiTaskSuggestPerMonth, lim.starter.aiTaskSuggestPerMonth, lim.professional.aiTaskSuggestPerMonth, "unlimited"] },
    ],
  },
  {
    da: "Integrationer",
    en: "Integrations",
    rows: [
      { da: "CRM-integrationer", en: "CRM integrations", values: ["—", "—", 1, 3] },
      { da: "Brand-personalisering", en: "Brand personalisation", values: [false, true, true, true] },
      { da: "iCal-eksport", en: "iCal export", values: [true, true, true, true] },
    ],
  },
  {
    da: "Team & support",
    en: "Team & support",
    rows: [
      { da: "Teammedlemmer", en: "Team members", values: ["—", "—", "—", "unlimited"] },
      { da: "Delte searches & triggers", en: "Shared searches & triggers", values: [false, false, false, true] },
      { da: "Prioriteret support", en: "Priority support", values: [false, false, false, true] },
      { da: "Organisations-auditlog", en: "Org audit log", values: [false, false, false, true] },
    ],
  },
];

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQ({ locale }: { locale: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const title = locale === "da" ? "Ofte stillede spørgsmål" : "Frequently asked questions";
  const items = locale === "da"
    ? [
        { q: "Kan jeg skifte plan til enhver tid?", a: "Ja. Opgradering træder i kraft øjeblikkeligt. Nedgradering træder i kraft ved udgangen af den aktuelle faktureringsperiode." },
        { q: "Er der en bindingsperiode?", a: "Nej. Alle planer er løbende og kan opsiges til enhver tid. Ved årsabonnement faktureres hele perioden forud." },
        { q: "Hvad sker der, når jeg når min grænse?", a: "Du får en advarsel, når du nærmer dig grænsen. Når grænsen er nået, er den pågældende funktion midlertidigt deaktiveret, indtil du opgraderer eller en ny måned begynder." },
        { q: "Tilbyder I en gratis prøveperiode?", a: "Free-planen er permanent gratis — ingen kreditkort nødvendigt. Du kan afprøve kernefunktionerne uden tidsbegrænsning." },
        { q: "Hvad inkluderer Enterprise for teamfunktioner?", a: "Enterprise inkluderer ubegrænsede teammedlemmer, delte gemte virksomheder, triggers og søgninger, rollebaseret adgangsstyring og organisations-auditlog." },
        { q: "Hvem er den juridiske leverandør?", a: "CVR-MATE er et produkt fra Fourmates ApS (CVR-nr. 46256204), Vindingvej 34, 7100 Vejle. Fakturering sker via Stripe." },
      ]
    : [
        { q: "Can I switch plans at any time?", a: "Yes. Upgrades take effect immediately. Downgrades take effect at the end of the current billing period." },
        { q: "Is there a minimum commitment?", a: "No. All plans are rolling and can be cancelled at any time. Annual plans are billed in full upfront." },
        { q: "What happens when I hit my limit?", a: "You'll receive a warning as you approach your limit. Once reached, that feature is temporarily disabled until you upgrade or a new month begins." },
        { q: "Do you offer a free trial?", a: "The Free plan is permanently free — no credit card required. You can explore core features with no time limit." },
        { q: "What team features are included in Enterprise?", a: "Enterprise includes unlimited team members, shared saved companies, triggers and searches, role-based access control, and an organisation audit log." },
        { q: "Who is the legal provider?", a: "CVR-MATE is a product of Fourmates ApS (CVR no. 46256204), Vindingvej 34, 7100 Vejle, Denmark. Billing is handled by Stripe." },
      ];

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 py-24">
      <h2 className="font-[family-name:var(--font-manrope)] text-2xl sm:text-3xl font-extrabold text-white text-center mb-12 tracking-tight">
        {title}
      </h2>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="border border-white/[0.08] rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-slate-200 hover:bg-white/[0.04] transition-colors"
            >
              <span>{item.q}</span>
              {open === i ? <ChevronUp className="size-4 text-slate-400 shrink-0" /> : <ChevronDown className="size-4 text-slate-400 shrink-0" />}
            </button>
            {open === i && (
              <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed border-t border-white/[0.06]">
                <p className="pt-3">{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PricingContent() {
  const { locale, t, toggleLocale } = useLanguage();
  const [interval, setInterval] = useState<Interval>("monthly");

  const da = locale === "da";

  const planNames: Record<string, { name: string; desc: string; cta: string }> = {
    free:         { name: t.pricing.free.name,         desc: t.pricing.free.desc,         cta: t.pricing.free.cta },
    starter:      { name: t.pricing.starter.name,      desc: t.pricing.starter.desc,      cta: t.pricing.starter.cta },
    professional: { name: t.pricing.professional.name, desc: t.pricing.professional.desc, cta: t.pricing.professional.cta },
    enterprise:   { name: t.pricing.enterprise.name,   desc: t.pricing.enterprise.desc,   cta: t.pricing.enterprise.cta },
  };

  const planFeatures: Record<string, string[]> = {
    free:         t.pricing.free.features,
    starter:      t.pricing.starter.features,
    professional: t.pricing.professional.features,
    enterprise:   t.pricing.enterprise.features,
  };

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "#080c18",
        backgroundImage: `
          radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59,130,246,0.12) 0%, transparent 60%),
          linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 40px 40px, 40px 40px",
      }}
    >
      {/* ─── Nav ─────────────────────────────────────────────── */}
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-[family-name:var(--font-manrope)] font-bold text-white">CVR-MATE</span>
        </Link>
        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <button
            onClick={toggleLocale}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-all"
            aria-label="Toggle language"
          >
            <span className={`text-xs font-bold transition-colors ${locale === "da" ? "text-white" : "text-slate-500"}`}>DA</span>
            <span className="text-slate-700 text-xs">|</span>
            <span className={`text-xs font-bold transition-colors ${locale === "en" ? "text-white" : "text-slate-500"}`}>EN</span>
          </button>
          <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
            {da ? "Log ind" : "Log in"}
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-white/[0.08] border border-white/[0.12] text-white hover:bg-white/[0.12] transition-all"
          >
            {da ? "Kom i gang" : "Get started"}
          </Link>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-bold uppercase tracking-widest text-blue-400 mb-6">
          {da ? "Prissætning" : "Pricing"}
        </div>
        <h1 className="font-[family-name:var(--font-manrope)] text-4xl sm:text-6xl font-extrabold tracking-tight mb-4 leading-none">
          <span className="bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
            {t.pricing.title}
          </span>
        </h1>
        <p className="text-lg text-slate-500 mb-10 max-w-lg mx-auto">{t.pricing.subtitle}</p>

        {/* Billing toggle */}
        <div className="inline-flex bg-white/[0.05] rounded-full p-1 gap-1 border border-white/[0.08]">
          <button
            onClick={() => setInterval("monthly")}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
              interval === "monthly" ? "bg-white/[0.1] text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.pricing.monthly}
          </button>
          <button
            onClick={() => setInterval("annual")}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${
              interval === "annual" ? "bg-white/[0.1] text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.pricing.annual}
            <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
              {t.pricing.annualSave}
            </span>
          </button>
        </div>
      </section>

      {/* ─── Plan cards ──────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLAN_CONFIGS.map((plan) => {
            const info = planNames[plan.id];
            const features = planFeatures[plan.id];
            const price = interval === "annual" ? plan.annualPrice : plan.monthlyPrice;
            const isFree = plan.monthlyPrice === 0;

            if (plan.featured) {
              return (
                <div key={plan.id} className="relative lg:-mt-4">
                  {/* Gradient border */}
                  <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-blue-500 via-cyan-500 to-blue-700 opacity-70 blur-[1px]" />
                  <div className="relative flex flex-col h-full bg-[#0d1525] rounded-2xl p-6 border border-white/[0.06]">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-full whitespace-nowrap shadow-lg">
                        {t.pricing.recommended}
                      </span>
                    </div>
                    <div className="mb-5 mt-2">
                      <h3 className="font-[family-name:var(--font-manrope)] text-base font-extrabold text-white mb-1">{info.name}</h3>
                      <p className="text-xs text-slate-500">{info.desc}</p>
                    </div>
                    <div className="mb-6">
                      <div className="flex items-end gap-1.5">
                        <span className="font-[family-name:var(--font-manrope)] text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent tabular-nums">
                          {price.toLocaleString()}
                        </span>
                        <span className="text-sm text-slate-500 mb-1">DKK{t.pricing.period}</span>
                      </div>
                      {interval === "annual" && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          {t.pricing.billedAnnually} {plan.annualTotal.toLocaleString()} DKK{t.pricing.perYear}
                        </p>
                      )}
                    </div>
                    <ul className="space-y-2.5 mb-8 flex-1">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                          <Check className="size-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/signup"
                      className="block w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-center font-extrabold text-sm text-white hover:shadow-lg hover:shadow-blue-500/25 transition-all"
                    >
                      {info.cta}
                    </Link>
                  </div>
                </div>
              );
            }

            if (plan.enterprise) {
              return (
                <div key={plan.id} className="flex flex-col bg-white/[0.03] rounded-2xl p-6 border border-white/[0.06] hover:border-white/[0.12] transition-colors">
                  <div className="mb-5">
                    <h3 className="font-[family-name:var(--font-manrope)] text-base font-extrabold text-white mb-1">{info.name}</h3>
                    <p className="text-xs text-slate-500">{info.desc}</p>
                  </div>
                  <div className="mb-6">
                    <div className="flex items-end gap-1.5">
                      <span className="font-[family-name:var(--font-manrope)] text-4xl font-extrabold text-white tabular-nums">
                        {price.toLocaleString()}
                      </span>
                      <span className="text-sm text-slate-500 mb-1">DKK{t.pricing.period}</span>
                    </div>
                    {interval === "annual" && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        {t.pricing.billedAnnually} {plan.annualTotal.toLocaleString()} DKK{t.pricing.perYear}
                      </p>
                    )}
                  </div>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-slate-400">
                        <Check className="size-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`mailto:support@cvr-mate.dk?subject=${encodeURIComponent(da ? "Enterprise-forespørgsel" : "Enterprise Inquiry")}`}
                    className="block w-full py-2.5 rounded-xl border border-white/[0.12] text-center font-bold text-sm text-slate-300 hover:bg-white/[0.06] transition-all"
                  >
                    {info.cta}
                  </Link>
                </div>
              );
            }

            // Free and Starter cards
            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl p-6 border transition-colors ${
                  isFree
                    ? "bg-white/[0.02] border-white/[0.05] hover:border-white/[0.08]"
                    : "bg-white/[0.04] border-white/[0.08] hover:border-white/[0.14]"
                }`}
              >
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-[family-name:var(--font-manrope)] text-base font-extrabold text-white">{info.name}</h3>
                    {isFree && (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                        {t.pricing.freeForever}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{info.desc}</p>
                </div>
                <div className="mb-6">
                  <div className="flex items-end gap-1.5">
                    <span className={`font-[family-name:var(--font-manrope)] text-4xl font-extrabold tabular-nums ${isFree ? "text-slate-500" : "text-white"}`}>
                      {price === 0 ? "0" : price.toLocaleString()}
                    </span>
                    <span className="text-sm text-slate-600 mb-1">DKK{t.pricing.period}</span>
                  </div>
                  {interval === "annual" && !isFree && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      {t.pricing.billedAnnually} {plan.annualTotal.toLocaleString()} DKK{t.pricing.perYear}
                    </p>
                  )}
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {features.map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-xs ${isFree ? "text-slate-500" : "text-slate-400"}`}>
                      <Check className={`size-3.5 shrink-0 mt-0.5 ${isFree ? "text-slate-600" : "text-cyan-400"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`block w-full py-2.5 rounded-xl text-center font-bold text-sm transition-all ${
                    isFree
                      ? "border border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]"
                      : "border border-white/[0.12] text-slate-300 hover:bg-white/[0.06]"
                  }`}
                >
                  {info.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* VAT note */}
        <p className="text-center text-xs text-slate-600 mt-4">{t.pricing.vatNote}</p>
      </section>

      {/* ─── Comparison table ─────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="font-[family-name:var(--font-manrope)] text-xl font-extrabold text-white text-center mb-10 tracking-tight">
          {t.pricing.compareAll}
        </h2>

        <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
          {/* Sticky plan header row */}
          <div className="sticky top-0 z-10 grid grid-cols-5 bg-[#0a0f1c] border-b border-white/[0.08]">
            <div className="px-5 py-4 text-xs text-slate-500 font-semibold" />
            {PLAN_CONFIGS.map((plan) => (
              <div
                key={plan.id}
                className={`px-3 py-4 text-center ${plan.featured ? "bg-blue-500/[0.08]" : ""}`}
              >
                <p className={`font-[family-name:var(--font-manrope)] text-xs font-extrabold ${plan.featured ? "text-cyan-400" : "text-slate-300"}`}>
                  {planNames[plan.id].name}
                </p>
              </div>
            ))}
          </div>

          {/* Feature groups */}
          {FEATURE_GROUPS.map((group, gi) => (
            <div key={gi}>
              {/* Group header */}
              <div className="grid grid-cols-5 bg-white/[0.025] border-b border-white/[0.06]">
                <div className="col-span-5 px-5 py-2.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                    {da ? group.da : group.en}
                  </span>
                </div>
              </div>
              {/* Rows */}
              {group.rows.map((row, ri) => (
                <div
                  key={ri}
                  className={`grid grid-cols-5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
                    ri === group.rows.length - 1 ? "border-b-white/[0.07]" : ""
                  }`}
                >
                  <div className="px-5 py-3 text-xs text-slate-400 flex items-center">
                    {da ? row.da : row.en}
                  </div>
                  {row.values.map((val, vi) => {
                    const plan = PLAN_CONFIGS[vi];
                    return (
                      <div
                        key={vi}
                        className={`px-3 py-3 text-center text-sm text-slate-300 flex items-center justify-center ${
                          plan.featured ? "bg-blue-500/[0.04]" : ""
                        }`}
                      >
                        {fmt(val, locale)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────── */}
      <FAQ locale={locale} />

      {/* ─── Bottom CTA ──────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center border-t border-white/[0.06]">
        <h2 className="font-[family-name:var(--font-manrope)] text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
          {da ? "Start gratis i dag" : "Start for free today"}
        </h2>
        <p className="text-slate-500 mb-8 max-w-md mx-auto text-sm">
          {da
            ? "Ingen kreditkort nødvendigt. Opgrader til enhver tid."
            : "No credit card required. Upgrade at any time."}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-center font-extrabold text-sm text-white hover:shadow-lg hover:shadow-blue-500/25 transition-all"
          >
            {da ? "Opret gratis konto" : "Create free account"}
          </Link>
          <Link
            href="/#pricing"
            className="w-full sm:w-auto px-8 py-3 rounded-xl border border-white/[0.12] text-center font-bold text-sm text-slate-300 hover:bg-white/[0.06] transition-all"
          >
            {da ? "Se alle funktioner" : "View all features"}
          </Link>
        </div>
        <p className="mt-8 text-[11px] text-slate-600">
          {da
            ? "CVR-MATE er et produkt fra Fourmates ApS (CVR-nr. 46256204) · "
            : "CVR-MATE is a product of Fourmates ApS (CVR no. 46256204) · "}
          <Link href="/terms" className="hover:text-slate-400 transition-colors">{da ? "Vilkår" : "Terms"}</Link>
          {" · "}
          <Link href="/privacy" className="hover:text-slate-400 transition-colors">{da ? "Privatliv" : "Privacy"}</Link>
        </p>
      </section>
    </div>
  );
}
