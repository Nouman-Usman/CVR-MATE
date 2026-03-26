"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { useCompany } from "@/lib/hooks/use-company";
import { useSavedCvrSet, useSaveCompany, useUnsaveCompany } from "@/lib/hooks/use-saved-companies";
import { useCompanyBriefing, useSavedBriefings } from "@/lib/hooks/use-company-briefing";
import { useOutreach, useOutreachMessages } from "@/lib/hooks/use-outreach";
import { useSuggestTodos } from "@/lib/hooks/use-suggest-todos";
import { useCreateTodo } from "@/lib/hooks/use-todos";
import { useActiveConnections, usePushToCrm, useSyncStatus } from "@/lib/hooks/use-integrations";

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

  // TanStack Query for company data (cached 1hr)
  const validVat = vat && /^\d{8}$/.test(vat) ? vat : undefined;
  const { data: companyData, isLoading: loading, error: fetchError } = useCompany(validVat);
  const company = (companyData?.company as CompanyData) ?? null;
  const error = !validVat ? cd.notFound : fetchError ? cd.error : "";

  // Saved state via shared TanStack Query cache
  const savedCvrs = useSavedCvrSet();
  const saveMutation = useSaveCompany();
  const unsaveMutation = useUnsaveCompany();
  const isSaved = savedCvrs.has(vat);
  const saving = saveMutation.isPending || unsaveMutation.isPending;

  const [activeTab, setActiveTab] = useState<
    "overview" | "financials" | "contact" | "people" | "ai-briefing"
  >("overview");

  // AI features
  const briefingMutation = useCompanyBriefing();
  const outreachMutation = useOutreach();
  const suggestTodosMutation = useSuggestTodos();
  const createTodoMutation = useCreateTodo();
  const [showOutreach, setShowOutreach] = useState(false);
  const [outreachType, setOutreachType] = useState<"email" | "linkedin" | "phone_script">("email");
  const [outreachTone, setOutreachTone] = useState<"formal" | "casual">("formal");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showOutreachHistory, setShowOutreachHistory] = useState(false);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<string | null>(null);
  const [showTodoSuggestions, setShowTodoSuggestions] = useState(false);
  const [addedTodos, setAddedTodos] = useState<Set<number>>(new Set());

  // Saved outreach messages
  const outreachMessages = useOutreachMessages(validVat);

  // Saved briefings
  const savedBriefings = useSavedBriefings(validVat);
  const [showBriefingHistory, setShowBriefingHistory] = useState(false);
  const [viewingBriefingItem, setViewingBriefingItem] = useState<string | null>(null);

  // CRM Integration
  const activeConnections = useActiveConnections();
  const pushToCrm = usePushToCrm();
  const [showCrmMenu, setShowCrmMenu] = useState(false);
  const [crmToast, setCrmToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const handleSaveToggle = () => {
    if (!company) return;
    if (isSaved) {
      unsaveMutation.mutate(vat);
    } else {
      saveMutation.mutate({
        vat: String(company.vat),
        name: company.life.name,
        rawData: company as unknown as Record<string, unknown>,
      });
    }
  };

  const ai = t.ai;
  const tabs = [
    { key: "overview" as const, label: cd.overview, icon: "info" },
    { key: "financials" as const, label: cd.financials, icon: "bar_chart" },
    { key: "contact" as const, label: cd.contact, icon: "call" },
    { key: "people" as const, label: cd.people, icon: "groups" },
    { key: "ai-briefing" as const, label: ai.briefing.tab, icon: "auto_awesome" },
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOutreach(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100"
              >
                <span className="material-symbols-outlined text-lg">edit_note</span>
                {ai.outreach.button}
              </button>
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

              {/* Push to CRM */}
              {activeConnections.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowCrmMenu(!showCrmMenu)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  >
                    <span className="material-symbols-outlined text-lg">sync</span>
                    {t.integrations.pushToCrm}
                  </button>
                  {showCrmMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowCrmMenu(false)} />
                      <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-slate-100 py-2 min-w-[200px]">
                        {activeConnections.map((conn) => (
                          <button
                            key={conn.id}
                            onClick={() => {
                              setShowCrmMenu(false);
                              // We need the company DB id — use the vat to fetch it
                              pushToCrm.mutate(
                                { connectionId: conn.id, companyId: (company as unknown as Record<string, string>)?.id || vat },
                                {
                                  onSuccess: (res) => {
                                    setCrmToast({ msg: `${t.integrations.pushSuccess} ${conn.provider}`, type: "success" });
                                    setTimeout(() => setCrmToast(null), 3000);
                                  },
                                  onError: (err) => {
                                    setCrmToast({ msg: `${t.integrations.pushError}: ${err.message}`, type: "error" });
                                    setTimeout(() => setCrmToast(null), 4000);
                                  },
                                }
                              );
                            }}
                            disabled={pushToCrm.isPending}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-base text-slate-400">
                              {conn.provider === "hubspot" ? "hub" : conn.provider === "salesforce" ? "cloud" : "filter_alt"}
                            </span>
                            <span className="font-medium capitalize">{conn.provider}</span>
                            {pushToCrm.isPending && (
                              <span className="material-symbols-outlined text-sm text-blue-500 animate-spin ml-auto">progress_activity</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* CRM Toast */}
          {crmToast && (
            <div className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-2.5 animate-[fadeIn_0.2s] ${
              crmToast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            }`}>
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                {crmToast.type === "success" ? "check_circle" : "error"}
              </span>
              {crmToast.msg}
            </div>
          )}

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

          {/* AI Briefing Tab */}
          {activeTab === "ai-briefing" && (() => {
            // Use freshly generated briefing if available, else the latest saved one
            const latestSaved = savedBriefings.data?.[0];
            const activeBriefing = briefingMutation.data?.briefing
              ? briefingMutation.data
              : latestSaved
                ? { briefing: latestSaved.briefing, keyInsights: latestSaved.keyInsights as string[], suggestedApproach: latestSaved.suggestedApproach }
                : null;
            const hasSavedHistory = (savedBriefings.data?.length ?? 0) > 0;

            // Treat as loading while query is in initial loading OR fetching state
            const isLoadingSaved = savedBriefings.isLoading || (savedBriefings.isFetching && !savedBriefings.data);

            return (
            <div className="space-y-6">
              {/* Loading saved briefings */}
              {isLoadingSaved && !briefingMutation.isPending && !activeBriefing && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-8 text-center">
                  <div className="w-10 h-10 border-3 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">{ai.briefing.generating}</p>
                </div>
              )}

              {/* Generate / Regenerate — show only when saved data loaded and empty */}
              {!activeBriefing && !briefingMutation.isPending && !isLoadingSaved && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl text-white">auto_awesome</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{ai.briefing.tab}</h3>
                  <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                    {ai.briefing.empty}
                  </p>
                  <button
                    onClick={() => briefingMutation.mutate({ vat, locale, companyData: company as unknown as Record<string, unknown> })}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm hover:from-violet-700 hover:to-purple-700 transition-all shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">auto_awesome</span>
                    {ai.briefing.generate}
                  </button>
                  {briefingMutation.isError && (
                    <p className="text-sm text-red-500 mt-4">{ai.briefing.error}</p>
                  )}
                </div>
              )}

              {/* Loading */}
              {briefingMutation.isPending && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-8 text-center">
                  <div className="w-10 h-10 border-3 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">{ai.briefing.generating}</p>
                </div>
              )}

              {/* Briefing History */}
              {showBriefingHistory && hasSavedHistory && (
                <div className="space-y-3">
                  {savedBriefings.data?.map((b) => {
                    const isViewing = viewingBriefingItem === b.id;
                    return (
                      <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-slate-100/60 overflow-hidden">
                        <button
                          onClick={() => setViewingBriefingItem(isViewing ? null : b.id)}
                          className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="material-symbols-outlined text-violet-500 text-lg">auto_awesome</span>
                            <span className="text-sm font-medium text-slate-700 truncate">{ai.briefing.tab}</span>
                            <span className="text-xs text-slate-400">
                              {new Date(b.createdAt).toLocaleDateString(locale === "da" ? "da-DK" : "en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <span className="material-symbols-outlined text-sm text-slate-400">
                            {isViewing ? "expand_less" : "expand_more"}
                          </span>
                        </button>
                        {isViewing && (
                          <div className="px-4 pb-4 space-y-4 border-t border-slate-50">
                            <div className="pt-3 prose prose-sm prose-slate max-w-none">
                              {b.briefing.split("\n").filter(Boolean).map((p, i) => (
                                <p key={i} className="text-sm text-slate-700 leading-relaxed mb-3 last:mb-0">{p}</p>
                              ))}
                            </div>
                            {(b.keyInsights as string[])?.length > 0 && (
                              <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{ai.briefing.keyInsights}</h3>
                                <div className="space-y-2">
                                  {(b.keyInsights as string[]).map((insight, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-100">
                                      <span className="material-symbols-outlined text-amber-500 text-lg mt-0.5 shrink-0">arrow_right</span>
                                      <p className="text-sm text-slate-700 font-medium">{insight}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {b.suggestedApproach && (
                              <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{ai.briefing.suggestedApproach}</h3>
                                <p className="text-sm text-slate-700 leading-relaxed">{b.suggestedApproach}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Active Briefing Result */}
              {activeBriefing && !briefingMutation.isPending && !showBriefingHistory && (
                <>
                  {/* Briefing text */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <span className="material-symbols-outlined text-lg text-violet-600">auto_awesome</span>
                          {ai.briefing.tab}
                        </h2>
                        {briefingMutation.data?.briefing && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase">
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            {ai.briefing.saved}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {hasSavedHistory && (savedBriefings.data?.length ?? 0) > 1 && (
                          <button
                            onClick={() => { setShowBriefingHistory(true); setViewingBriefingItem(null); }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">history</span>
                            {ai.briefing.viewHistory}
                            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold">
                              {savedBriefings.data?.length}
                            </span>
                          </button>
                        )}
                        <button
                          onClick={() => briefingMutation.mutate({ vat, locale, companyData: company as unknown as Record<string, unknown> })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">refresh</span>
                          {ai.briefing.regenerate}
                        </button>
                      </div>
                    </div>
                    <div className="prose prose-sm prose-slate max-w-none">
                      {activeBriefing.briefing.split("\n").filter(Boolean).map((p, i) => (
                        <p key={i} className="text-sm text-slate-700 leading-relaxed mb-3 last:mb-0">{p}</p>
                      ))}
                    </div>
                  </div>

                  {/* Key Insights */}
                  {activeBriefing.keyInsights?.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                      <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg text-amber-500">lightbulb</span>
                        {ai.briefing.keyInsights}
                      </h2>
                      <div className="space-y-2">
                        {activeBriefing.keyInsights.map((insight, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-100">
                            <span className="material-symbols-outlined text-amber-500 text-lg mt-0.5 shrink-0">arrow_right</span>
                            <p className="text-sm text-slate-700 font-medium">{insight}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Approach */}
                  {activeBriefing.suggestedApproach && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                      <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg text-emerald-500">route</span>
                        {ai.briefing.suggestedApproach}
                      </h2>
                      <p className="text-sm text-slate-700 leading-relaxed">{activeBriefing.suggestedApproach}</p>
                    </div>
                  )}

                  {/* Suggest Tasks */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg text-blue-600">task_alt</span>
                        {ai.todos.suggest}
                      </h2>
                      <button
                        onClick={() => {
                          setShowTodoSuggestions(true);
                          setAddedTodos(new Set());
                          suggestTodosMutation.mutate({ vat, locale, companyData: company as unknown as Record<string, unknown> });
                        }}
                        disabled={suggestTodosMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">auto_awesome</span>
                        {suggestTodosMutation.isPending ? ai.todos.suggesting : ai.todos.suggest}
                      </button>
                    </div>

                    {showTodoSuggestions && suggestTodosMutation.isPending && (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}

                    {showTodoSuggestions && suggestTodosMutation.data?.suggestions && (
                      <div className="space-y-2">
                        {suggestTodosMutation.data.suggestions.map((suggestion, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  suggestion.priority === "high" ? "bg-red-50 text-red-600" :
                                  suggestion.priority === "medium" ? "bg-amber-50 text-amber-600" :
                                  "bg-slate-50 text-slate-500"
                                }`}>
                                  {suggestion.priority}
                                </span>
                                <span className="text-[10px] text-slate-400">{suggestion.dueInDays}d</span>
                              </div>
                              <p className="text-sm font-medium text-slate-800">{suggestion.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{suggestion.description}</p>
                            </div>
                            <button
                              onClick={() => {
                                const dueDate = new Date();
                                dueDate.setDate(dueDate.getDate() + suggestion.dueInDays);
                                createTodoMutation.mutate({
                                  title: suggestion.title,
                                  description: suggestion.description,
                                  priority: suggestion.priority,
                                  dueDate: dueDate.toISOString().split("T")[0],
                                  cvr: vat,
                                });
                                setAddedTodos(prev => new Set(prev).add(i));
                              }}
                              disabled={addedTodos.has(i) || createTodoMutation.isPending}
                              className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                                addedTodos.has(i)
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm">
                                {addedTodos.has(i) ? "check" : "add"}
                              </span>
                              {addedTodos.has(i) ? ai.todos.added : ai.todos.addTask}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {showTodoSuggestions && suggestTodosMutation.isError && (
                      <p className="text-sm text-red-500">{ai.todos.error}</p>
                    )}

                    {!showTodoSuggestions && (
                      <p className="text-sm text-slate-400 text-center py-4">
                        {ai.todos.suggest}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Back to current briefing from history */}
              {showBriefingHistory && (
                <div className="text-center">
                  <button
                    onClick={() => setShowBriefingHistory(false)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    {ai.briefing.hideHistory}
                  </button>
                </div>
              )}
            </div>
            );
          })()}

          {/* Outreach Slide-over */}
          {showOutreach && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowOutreach(false)} />
              <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-violet-600">edit_note</span>
                    {ai.outreach.title}
                  </h2>
                  <div className="flex items-center gap-2">
                    {outreachMessages.data && outreachMessages.data.length > 0 && (
                      <button
                        onClick={() => { setShowOutreachHistory(!showOutreachHistory); setViewingHistoryItem(null); }}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          showOutreachHistory ? "bg-violet-100 text-violet-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">history</span>
                        {showOutreachHistory ? ai.outreach.hideHistory : ai.outreach.viewHistory}
                        <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold">
                          {outreachMessages.data.length}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => setShowOutreach(false)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-slate-400">close</span>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* History view */}
                  {showOutreachHistory && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{ai.outreach.history}</h3>
                      {outreachMessages.data?.map((msg) => {
                        const isViewing = viewingHistoryItem === msg.id;
                        return (
                          <div key={msg.id} className="border border-slate-100 rounded-xl overflow-hidden">
                            <button
                              onClick={() => setViewingHistoryItem(isViewing ? null : msg.id)}
                              className="w-full flex items-center justify-between p-3 hover:bg-slate-50/50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  msg.type === "email" ? "bg-blue-50 text-blue-600" :
                                  msg.type === "linkedin" ? "bg-sky-50 text-sky-600" :
                                  "bg-amber-50 text-amber-600"
                                }`}>
                                  {msg.type === "email" ? ai.outreach.email : msg.type === "linkedin" ? ai.outreach.linkedin : ai.outreach.phoneScript}
                                </span>
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  msg.tone === "formal" ? "bg-slate-100 text-slate-500" : "bg-purple-50 text-purple-500"
                                }`}>
                                  {msg.tone === "formal" ? ai.outreach.formal : ai.outreach.casual}
                                </span>
                                <span className="text-xs text-slate-400 truncate">
                                  {new Date(msg.createdAt).toLocaleDateString(locale === "da" ? "da-DK" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <span className="material-symbols-outlined text-sm text-slate-400">
                                {isViewing ? "expand_less" : "expand_more"}
                              </span>
                            </button>
                            {isViewing && (
                              <div className="px-3 pb-3 space-y-3 border-t border-slate-50">
                                {msg.subject && (
                                  <div className="pt-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">{ai.outreach.subject}</label>
                                      <button
                                        onClick={() => { navigator.clipboard.writeText(msg.subject ?? ""); setCopiedField(`h-subject-${msg.id}`); setTimeout(() => setCopiedField(null), 2000); }}
                                        className="text-xs text-violet-600 hover:text-violet-700 font-semibold cursor-pointer"
                                      >
                                        {copiedField === `h-subject-${msg.id}` ? ai.outreach.copied : ai.outreach.copy}
                                      </button>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-800 font-medium">{msg.subject}</div>
                                  </div>
                                )}
                                <div className={msg.subject ? "" : "pt-3"}>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">{ai.outreach.message}</label>
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(msg.message); setCopiedField(`h-msg-${msg.id}`); setTimeout(() => setCopiedField(null), 2000); }}
                                      className="text-xs text-violet-600 hover:text-violet-700 font-semibold cursor-pointer"
                                    >
                                      {copiedField === `h-msg-${msg.id}` ? ai.outreach.copied : ai.outreach.copy}
                                    </button>
                                  </div>
                                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{msg.message}</div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">{ai.outreach.followUp}</label>
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(msg.followUp); setCopiedField(`h-fu-${msg.id}`); setTimeout(() => setCopiedField(null), 2000); }}
                                      className="text-xs text-violet-600 hover:text-violet-700 font-semibold cursor-pointer"
                                    >
                                      {copiedField === `h-fu-${msg.id}` ? ai.outreach.copied : ai.outreach.copy}
                                    </button>
                                  </div>
                                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{msg.followUp}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Generate new outreach */}
                  {!showOutreachHistory && (
                    <>
                      {/* Message type */}
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 block">{ai.outreach.type}</label>
                        <div className="flex gap-2">
                          {(["email", "linkedin", "phone_script"] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setOutreachType(t)}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                                outreachType === t ? "bg-violet-100 text-violet-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                              }`}
                            >
                              {t === "email" ? ai.outreach.email : t === "linkedin" ? ai.outreach.linkedin : ai.outreach.phoneScript}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Tone */}
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 block">{ai.outreach.tone}</label>
                        <div className="flex gap-2">
                          {(["formal", "casual"] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setOutreachTone(t)}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                                outreachTone === t ? "bg-violet-100 text-violet-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                              }`}
                            >
                              {t === "formal" ? ai.outreach.formal : ai.outreach.casual}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Generate button — uses brand products, no selling point needed */}
                      <button
                        onClick={() => outreachMutation.mutate({
                          vat,
                          type: outreachType,
                          tone: outreachTone,
                          locale,
                          companyData: company as unknown as Record<string, unknown>,
                        })}
                        disabled={outreachMutation.isPending}
                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm hover:from-violet-700 hover:to-purple-700 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-lg">
                          {outreachMutation.isPending ? "hourglass_empty" : "auto_awesome"}
                        </span>
                        {outreachMutation.isPending
                          ? ai.outreach.generating
                          : outreachMutation.data ? ai.outreach.regenerate : ai.outreach.generate}
                      </button>

                      {outreachMutation.isError && (
                        <p className="text-sm text-red-500">{ai.outreach.error}</p>
                      )}

                      {/* Result */}
                      {outreachMutation.data && !outreachMutation.isPending && !outreachMutation.data.message && (
                        <p className="text-sm text-red-500">{ai.outreach.error}</p>
                      )}

                      {outreachMutation.data && !outreachMutation.isPending && outreachMutation.data.message && (
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase">
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              {ai.outreach.saved}
                            </span>
                          </div>

                          {outreachMutation.data.subject && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">{ai.outreach.subject}</label>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(outreachMutation.data?.subject ?? "");
                                    setCopiedField("subject");
                                    setTimeout(() => setCopiedField(null), 2000);
                                  }}
                                  className="text-xs text-violet-600 hover:text-violet-700 font-semibold cursor-pointer"
                                >
                                  {copiedField === "subject" ? ai.outreach.copied : ai.outreach.copy}
                                </button>
                              </div>
                              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-800 font-medium">
                                {outreachMutation.data.subject}
                              </div>
                            </div>
                          )}

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">{ai.outreach.message}</label>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(outreachMutation.data?.message ?? "");
                                  setCopiedField("message");
                                  setTimeout(() => setCopiedField(null), 2000);
                                }}
                                className="text-xs text-violet-600 hover:text-violet-700 font-semibold cursor-pointer"
                              >
                                {copiedField === "message" ? ai.outreach.copied : ai.outreach.copy}
                              </button>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                              {outreachMutation.data.message}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">{ai.outreach.followUp}</label>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(outreachMutation.data?.followUp ?? "");
                                  setCopiedField("followup");
                                  setTimeout(() => setCopiedField(null), 2000);
                                }}
                                className="text-xs text-violet-600 hover:text-violet-700 font-semibold cursor-pointer"
                              >
                                {copiedField === "followup" ? ai.outreach.copied : ai.outreach.copy}
                              </button>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                              {outreachMutation.data.followUp}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
