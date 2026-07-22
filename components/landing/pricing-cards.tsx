"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import { COMING_SOON_FEATURES, CONTACT_EMAIL } from "@/lib/constants";
import { ComingSoonBadge } from "@/components/ui/coming-soon";

/* ─── Pricing ─────────────────────────────────────────────────────
   The plans are access tiers to the register, so the price is set in
   the same monospace tabular figures the CVR numbers use everywhere
   else on the page — pricing reads as part of the register system,
   not a generic SaaS grid. One tier is marked recommended with the
   same emerald live-dot the hero and how-it-works use; no rainbow
   ring, no gradient-clipped numerals.

   Annual is the default — the yearly saving is the standing offer, so
   that's the price shown first.
─────────────────────────────────────────────────────────────────── */

type Interval = "monthly" | "annual";

/** Prices arrive as locale-formatted strings ("1.359" / "1,699"); strip
 *  the grouping to a number so the yearly total can be computed. */
function toNumber(price: string): number {
  return Number(price.replace(/[^\d]/g, ""));
}

export function PricingCards() {
  const { locale, t } = useLanguage();
  const [interval, setInterval] = useState<Interval>("annual");
  const annual = interval === "annual";

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale === "da" ? "da-DK" : "en-US").format(n);

  const paidTiers = [
    { id: "starter" as const, data: t.pricing.starter, featured: false },
    { id: "professional" as const, data: t.pricing.professional, featured: true },
    { id: "enterprise" as const, data: t.pricing.enterprise, featured: false },
  ];

  return (
    <>
      {/* Interval control — annual selected by default */}
      <div className="mb-14 flex justify-center">
        <div
          role="group"
          aria-label={t.nav.pricing}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1"
        >
          {(["monthly", "annual"] as const).map((value) => {
            const active = interval === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setInterval(value)}
                className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                  active ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {value === "monthly" ? t.pricing.monthly : t.pricing.annual}
                {value === "annual" && (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                    {t.pricing.annualSave}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {/* Free */}
        <div className="pricing-card flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <TierHead name={t.pricing.free.name} desc={t.pricing.free.desc} />
          <div className="mt-6 mb-7">
            <p className="font-[family-name:var(--font-manrope)] text-3xl font-extrabold text-white">
              {t.pricing.freeForever}
            </p>
          </div>
          <FeatureList items={t.pricing.free.features} muted />
          <TierCta href="/signup" label={t.pricing.free.cta} />
        </div>

        {paidTiers.map(({ id, data, featured }) => {
          const shown = annual ? data.annualPrice : data.price;
          const yearlyTotal = fmt(toNumber(data.annualPrice) * 12);
          const isTeam = id === "enterprise" && COMING_SOON_FEATURES.has("team");

          return (
            <div
              key={id}
              className={`pricing-card relative flex flex-col rounded-2xl border p-6 ${
                featured
                  ? "border-cyan-400/40 bg-cyan-400/[0.04] shadow-[0_0_45px_-12px_rgba(34,211,238,0.35)]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              {featured && (
                <span className="absolute right-6 top-0 flex -translate-y-1/2 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-[#0a0f1e] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                  </span>
                  {t.pricing.recommended}
                </span>
              )}

              <div className="flex items-start justify-between gap-2">
                <TierHead name={data.name} desc={data.desc} />
                {isTeam && <ComingSoonBadge />}
              </div>

              {/* Price — mono tabular figures, like the register numbers */}
              <div className="mt-6 mb-7">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[2.6rem] font-bold leading-none tabular-nums tracking-tight text-white">
                    {shown}
                  </span>
                  <span className="font-mono text-sm text-slate-500">
                    DKK{t.pricing.period}
                  </span>
                </div>
                <p className="mt-2 flex min-h-5 items-center gap-2 text-xs">
                  {annual ? (
                    <>
                      <span className="text-slate-600 line-through">
                        {data.price} DKK
                      </span>
                      <span className="font-mono text-slate-400">
                        {t.pricing.billedAnnually} {yearlyTotal} DKK{t.pricing.perYear}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-600">{t.pricing.vatNote}</span>
                  )}
                </p>
              </div>

              <FeatureList items={data.features} muted={!featured} />

              {isTeam ? (
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                    "CVR-MATE Enterprise Inquiry"
                  )}`}
                  className="mt-auto block rounded-xl bg-amber-600 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-amber-700"
                >
                  {data.cta}
                </a>
              ) : featured ? (
                <Link
                  href="/signup"
                  className="mt-auto block rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-center text-sm font-bold text-white transition-shadow hover:shadow-lg hover:shadow-cyan-500/25"
                >
                  {data.cta}
                </Link>
              ) : (
                <TierCta href="/signup" label={data.cta} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function TierHead({ name, desc }: { name: string; desc: string }) {
  return (
    <div>
      <h3 className="font-[family-name:var(--font-manrope)] text-lg font-bold text-white">
        {name}
      </h3>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </div>
  );
}

function FeatureList({ items, muted }: { items: string[]; muted: boolean }) {
  return (
    <ul className="mb-8 space-y-2.5">
      {items.map((f) => (
        <li
          key={f}
          className={`flex items-start gap-2.5 text-sm ${muted ? "text-slate-400" : "text-slate-300"}`}
        >
          <span className="material-symbols-outlined mt-0.5 shrink-0 text-sm text-cyan-400">
            check
          </span>
          {f}
        </li>
      ))}
    </ul>
  );
}

function TierCta({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-auto block rounded-xl border border-white/12 py-3 text-center text-sm font-bold text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      {label}
    </Link>
  );
}
