"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";

interface CompanyData {
  vat: number;
  slug: string;
  address: {
    street: string | null;
    zipcode: number | null;
    cityname: string | null;
    municipalityname: string | null;
  };
  companyform: {
    code: number | null;
    description: string | null;
    longdescription: string | null;
    holding: boolean;
  };
  companystatus: { text: string | null; start: string | null };
  contact: { email: string | null; www: string | null; phone: string | null };
  status: { code: number | null; bankrupt: boolean };
  industry: {
    primary: { code: number | null; text: string | null };
    secondary: { sequence: number; code: number; text: string }[];
  };
  life: {
    start: string | null;
    end: string | null;
    name: string;
    adprotected: boolean;
  };
  accounting?: {
    documents?: {
      summary?: {
        revenue: number | null;
        grossprofitloss: number | null;
        profitloss: number | null;
        equity: number | null;
        assets: number | null;
        averagenumberofemployees: number | null;
      };
    }[];
  };
  employment?: {
    months?: {
      amount: number | null;
      interval_low: number | null;
      interval_high: number | null;
      year: number;
      month: number;
    }[];
  };
  info?: {
    capital_amount: number | null;
    capital_currency: string | null;
    purpose: string | null;
  };
  participants?: {
    participantnumber: number;
    life: { name: string; profession: string | null };
    roles: { type: string; life: { title: string } };
  }[];
}

function formatDKK(value: number | null | undefined, locale: string): string {
  if (value == null) return "–";
  return new Intl.NumberFormat(locale === "da" ? "da-DK" : "en-US", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(
  dateStr: string | null | undefined,
  locale: string
): string {
  if (!dateStr) return "–";
  return new Date(dateStr).toLocaleDateString(
    locale === "da" ? "da-DK" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );
}

function InfoRow({
  icon,
  label,
  value,
  href,
  badge,
}: {
  icon: string;
  label: string;
  value: string | null | undefined;
  href?: string;
  badge?: { text: string; color: string } | null;
}) {
  const display = value || "–";
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <span className="material-symbols-outlined text-lg text-slate-400 mt-0.5 shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
          {label}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {href && value ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
            >
              {display}
            </a>
          ) : (
            <p className="text-sm font-medium text-slate-800 break-all">
              {display}
            </p>
          )}
          {badge && (
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.color}`}
            >
              {badge.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-blue-600 text-xl">
          {icon}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="text-lg font-bold text-slate-900 truncate">{value}</p>
      </div>
    </div>
  );
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useLanguage();
  const cd = t.companyDetail;
  const vat = params.vat as string;

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "financials" | "contact" | "people"
  >("overview");

  // Fetch company data
  useEffect(() => {
    if (!vat || !/^\d{8}$/.test(vat)) {
      setError(cd.notFound);
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [companyRes, savedRes] = await Promise.all([
          fetch(`/api/cvr/company?vat=${vat}`),
          fetch(`/api/cvr/saved`),
        ]);

        const companyData = await companyRes.json();
        if (!companyRes.ok) {
          setError(companyData.error || cd.error);
          return;
        }
        setCompany(companyData.company);

        if (savedRes.ok) {
          const savedData = await savedRes.json();
          const savedCvrs = (savedData.results || []).map(
            (s: { cvr: string }) => s.cvr
          );
          setIsSaved(savedCvrs.includes(vat));
        }
      } catch {
        setError(cd.error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [vat, cd.notFound, cd.error]);

  const handleSaveToggle = useCallback(async () => {
    if (!company) return;
    setSaving(true);
    try {
      if (isSaved) {
        await fetch(`/api/cvr/saved?cvr=${vat}`, { method: "DELETE" });
        setIsSaved(false);
      } else {
        await fetch("/api/cvr/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vat: company.vat,
            name: company.life.name,
            rawData: company,
          }),
        });
        setIsSaved(true);
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setSaving(false);
    }
  }, [company, isSaved, vat]);

  const tabs = [
    { key: "overview" as const, label: cd.overview, icon: "info" },
    { key: "financials" as const, label: cd.financials, icon: "bar_chart" },
    { key: "contact" as const, label: cd.contact, icon: "call" },
    { key: "people" as const, label: cd.people, icon: "groups" },
  ];

  // Financial data
  const accounting = company?.accounting?.documents?.[0]?.summary;
  const empData = company?.employment?.months?.[0];
  const statusColor = company?.status?.bankrupt
    ? "bg-red-50 text-red-700"
    : company?.companystatus?.text === "NORMAL"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-700";

  return (
    <DashboardLayout>
      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-400 font-medium">{cd.loading}</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-32">
          <span className="material-symbols-outlined text-5xl text-slate-200 mb-4">
            error
          </span>
          <p className="text-slate-400 font-medium mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">
              arrow_back
            </span>
            {cd.backToSearch}
          </button>
        </div>
      )}

      {/* Company Detail */}
      {!loading && !error && company && (
        <>
          {/* Back + Actions */}
          <div className="flex items-center justify-between mb-6 gap-4">
            <Link
              href="/search"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">
                arrow_back
              </span>
              {cd.backToSearch}
            </Link>
            <button
              onClick={handleSaveToggle}
              disabled={saving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer disabled:opacity-50 ${
                isSaved
                  ? "bg-blue-50 text-blue-600 border border-blue-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              }`}
            >
              <span
                className="material-symbols-outlined text-lg"
                style={
                  isSaved
                    ? { fontVariationSettings: "'FILL' 1" }
                    : undefined
                }
              >
                bookmark
              </span>
              {saving ? "..." : isSaved ? cd.saved : cd.save}
            </button>
          </div>

          {/* Company Header Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-7 mb-6">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-lg sm:text-xl shrink-0">
                {company.life.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)] mb-1">
                  {company.life.name}
                </h1>
                <div className="flex items-center gap-3 flex-wrap text-sm text-slate-500">
                  <span className="tabular-nums font-medium">
                    CVR {company.vat}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span>
                    {company.companyform?.longdescription ||
                      company.companyform?.description}
                  </span>
                  {company.address?.cityname && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span>
                        {company.address.zipcode} {company.address.cityname}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span
                    className={`inline-flex px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${statusColor}`}
                  >
                    {company.companystatus?.text}
                  </span>
                  {company.status?.bankrupt && (
                    <span className="inline-flex px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-50 text-red-700">
                      {cd.bankrupt}
                    </span>
                  )}
                  {company.life?.adprotected && (
                    <span className="inline-flex px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700">
                      {cd.adProtected}
                    </span>
                  )}
                  {company.companyform?.holding && (
                    <span className="inline-flex px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-violet-50 text-violet-700">
                      Holding
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard
              label={cd.employees}
              value={
                empData?.amount != null
                  ? empData.amount.toLocaleString(
                      locale === "da" ? "da-DK" : "en-US"
                    )
                  : "–"
              }
              icon="groups"
            />
            <StatCard
              label={cd.founded}
              value={
                company.life.start
                  ? new Date(company.life.start).getFullYear().toString()
                  : "–"
              }
              icon="calendar_month"
            />
            <StatCard
              label={cd.revenue}
              value={formatDKK(accounting?.revenue, locale)}
              icon="trending_up"
            />
            <StatCard
              label={cd.capital}
              value={
                company.info?.capital_amount != null
                  ? formatDKK(company.info.capital_amount, locale)
                  : "–"
              }
              icon="account_balance"
            />
          </div>

          {/* Tab navigation */}
          <div className="flex gap-1 mb-6 bg-white rounded-xl border border-slate-100/60 p-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="material-symbols-outlined text-lg">
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* General Info */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-blue-600">
                    info
                  </span>
                  {cd.overview}
                </h2>
                <InfoRow
                  icon="badge"
                  label={cd.cvr}
                  value={String(company.vat)}
                />
                <InfoRow
                  icon="business"
                  label={cd.name}
                  value={company.life.name}
                />
                <InfoRow
                  icon="category"
                  label={cd.companyForm}
                  value={
                    company.companyform?.longdescription ||
                    company.companyform?.description
                  }
                />
                <InfoRow
                  icon="flag"
                  label={cd.status}
                  value={company.companystatus?.text}
                  badge={
                    company.companystatus?.text === "NORMAL"
                      ? {
                          text: "Active",
                          color: "bg-emerald-50 text-emerald-700",
                        }
                      : null
                  }
                />
                <InfoRow
                  icon="calendar_month"
                  label={cd.founded}
                  value={formatDate(company.life.start, locale)}
                />
                <InfoRow
                  icon="factory"
                  label={cd.industry}
                  value={company.industry?.primary?.text}
                />
                <InfoRow
                  icon="tag"
                  label={cd.industryCode}
                  value={
                    company.industry?.primary?.code
                      ? String(company.industry.primary.code)
                      : null
                  }
                />
              </div>

              {/* Address & Location */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-blue-600">
                    location_on
                  </span>
                  {cd.address}
                </h2>
                <InfoRow
                  icon="home"
                  label={cd.address}
                  value={company.address?.street}
                />
                <InfoRow
                  icon="pin_drop"
                  label={cd.zipcode}
                  value={
                    company.address?.zipcode
                      ? String(company.address.zipcode)
                      : null
                  }
                />
                <InfoRow
                  icon="location_city"
                  label={cd.city}
                  value={company.address?.cityname}
                />
                <InfoRow
                  icon="map"
                  label={cd.municipality}
                  value={company.address?.municipalityname}
                />
                {company.info?.purpose && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      {cd.purpose}
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {company.info.purpose}
                    </p>
                  </div>
                )}

                {/* Secondary industries */}
                {company.industry?.secondary?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      {locale === "da"
                        ? "Sekundære brancher"
                        : "Secondary industries"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {company.industry.secondary.map((ind) => (
                        <span
                          key={ind.code}
                          className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-100"
                        >
                          {ind.text}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "financials" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
              <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-blue-600">
                  bar_chart
                </span>
                {cd.financials}
              </h2>
              {accounting ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    {
                      label: cd.revenue,
                      value: accounting.revenue,
                      icon: "trending_up",
                    },
                    {
                      label: cd.grossProfit,
                      value: accounting.grossprofitloss,
                      icon: "savings",
                    },
                    {
                      label: cd.profitLoss,
                      value: accounting.profitloss,
                      icon: "account_balance_wallet",
                    },
                    {
                      label: cd.equity,
                      value: accounting.equity,
                      icon: "account_balance",
                    },
                    {
                      label: cd.assets,
                      value: accounting.assets,
                      icon: "domain",
                    },
                    {
                      label: cd.employees,
                      value: accounting.averagenumberofemployees,
                      icon: "groups",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-slate-100 p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-lg text-slate-400">
                          {item.icon}
                        </span>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          {item.label}
                        </p>
                      </div>
                      <p
                        className={`text-xl font-bold tabular-nums ${
                          item.value != null && item.value < 0
                            ? "text-red-600"
                            : "text-slate-900"
                        }`}
                      >
                        {item.label === cd.employees
                          ? item.value != null
                            ? item.value.toLocaleString(
                                locale === "da" ? "da-DK" : "en-US"
                              )
                            : "–"
                          : formatDKK(item.value, locale)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-200 mb-2 block">
                    bar_chart
                  </span>
                  <p className="text-slate-400 font-medium">
                    {cd.noFinancials}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "contact" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
              <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-blue-600">
                  call
                </span>
                {cd.contact}
              </h2>
              {company.contact?.email ||
              company.contact?.phone ||
              company.contact?.www ? (
                <>
                  <InfoRow
                    icon="mail"
                    label={cd.email}
                    value={company.contact.email}
                    href={
                      company.contact.email
                        ? `mailto:${company.contact.email}`
                        : undefined
                    }
                  />
                  <InfoRow
                    icon="phone"
                    label={cd.phone}
                    value={company.contact.phone}
                    href={
                      company.contact.phone
                        ? `tel:${company.contact.phone}`
                        : undefined
                    }
                  />
                  <InfoRow
                    icon="language"
                    label={cd.website}
                    value={company.contact.www}
                    href={
                      company.contact.www
                        ? company.contact.www.startsWith("http")
                          ? company.contact.www
                          : `https://${company.contact.www}`
                        : undefined
                    }
                  />
                </>
              ) : (
                <div className="py-12 text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-200 mb-2 block">
                    contact_phone
                  </span>
                  <p className="text-slate-400 font-medium">{cd.noContact}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "people" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
              <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-blue-600">
                  groups
                </span>
                {cd.people}
              </h2>
              {company.participants && company.participants.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {company.participants.map((p, idx) => {
                    const personColors = [
                      "from-blue-500 to-cyan-400",
                      "from-violet-500 to-purple-400",
                      "from-amber-500 to-orange-400",
                      "from-emerald-500 to-teal-400",
                    ];
                    const grad = personColors[idx % personColors.length];
                    const initials = p.life.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <div
                        key={`${p.participantnumber}-${idx}`}
                        className="flex items-center gap-4 py-3.5"
                      >
                        <div
                          className={`w-10 h-10 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-bold shrink-0`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {p.life.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.roles?.life?.title || p.roles?.type || "–"}
                            {p.life.profession && ` · ${p.life.profession}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-200 mb-2 block">
                    person_off
                  </span>
                  <p className="text-slate-400 font-medium">{cd.noPeople}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
