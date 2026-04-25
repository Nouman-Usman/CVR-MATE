"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { useCompany } from "@/lib/hooks/use-company";
import { useSavedCvrSet, useSaveCompany, useUnsaveCompany } from "@/lib/hooks/use-saved-companies";
// import { useCompanyBriefing, useSavedBriefings } from "@/lib/hooks/use-company-briefing";
import { useOutreach, useOutreachMessages } from "@/lib/hooks/use-outreach";
import { useSuggestTodos } from "@/lib/hooks/use-suggest-todos";
import { useCreateTodo } from "@/lib/hooks/use-todos";
import { useActiveConnections, usePushToCrm, useSyncStatus } from "@/lib/hooks/use-integrations";
import { useEmailClientValue, buildComposeUrl } from "@/lib/hooks/use-email-client";
import { InlineLoader } from "@/components/loading-screen";
import { useCompanyEnrichment, useSavedEnrichment, type CompanyEnrichment } from "@/lib/hooks/use-enrichment";

interface AccountingSummary {
  revenue?: number | null;
  grossprofitloss?: number | null;
  profitloss?: number | null;
  equity?: number | null;
  assets?: number | null;
  averagenumberofemployees?: number | null;
  employeebenefitsexpense?: number | null;
  contributedcapital?: number | null;
  currentassets?: number | null;
  noncurrentassets?: number | null;
  liabilitiesotherthanprovisions?: number | null;
  retainedearnings?: number | null;
  liabilitiesandequity?: number | null;
  propertyplantandequipment?: number | null;
  shorttermliabilitiesotherthanprovisions?: number | null;
  longtermliabilitiesotherthanprovisions?: number | null;
  coverage?: number | null;
  operatingmargin?: number | null;
  roi?: number | null;
  liquidityratio?: number | null;
  solvencyratio?: number | null;
  equityreturn?: number | null;
  [key: string]: number | null | undefined;
}

interface AccountingDocument {
  url: string;
  type: string;
  start: string;
  end: string;
  publicdate: string | null;
  updated: string | null;
  currency: string | null;
  summary: AccountingSummary | [];
}

interface TaxRecord {
  year: number;
  tradeid: number;
  managementvat: number | null;
  companytype: string | null;
  taxlaw: string | null;
  taxableincome: number | null;
  deficit: number | null;
  paidtax: number | null;
  tonnageorcarbon: string | null;
}

interface ParticipantRole {
  type: string;
  life: {
    start?: string | null;
    end?: string | null;
    title?: string | null;
    owner_percent?: number | null;
    owner_voting_percent?: number | null;
  };
}

interface Participant {
  participantnumber?: number;
  vat?: number;
  slug?: string;
  address?: {
    street?: string | null;
    zipcode?: number | null;
    cityname?: string | null;
    countrycode?: string | null;
    freetext?: string | null;
  };
  life: {
    name: string;
    profession?: string | null;
    deceased?: boolean;
    adprotected?: boolean;
  };
  participant?: boolean;
  company?: boolean;
  roles: ParticipantRole[];
  companyform?: { description: string | null; longdescription: string | null };
}

interface Subsidiary {
  subsidiarynumber: number;
  vat: number;
  slug: string;
  address: {
    street: string | null;
    numberfrom: number | null;
    floor: string | null;
    door: string | null;
    zipcode: number | null;
    cityname: string | null;
    municipalityname: string | null;
  };
  life: {
    start: string | null;
    end: string | null;
    name: string;
    adprotected: boolean;
    main: boolean;
  };
}

interface CompanyData {
  vat: number;
  slug: string;
  address: {
    street: string | null;
    numberfrom: number | null;
    numberto: number | null;
    letterfrom: string | null;
    floor: string | null;
    door: string | null;
    zipcode: number | null;
    cityname: string | null;
    countrycode: string | null;
    municipalityname: string | null;
    coname: string | null;
    longitude: number | null;
    latitude: number | null;
  };
  companyform: {
    code: number | null;
    description: string | null;
    longdescription: string | null;
    holding: boolean;
  };
  companystatus: { text: string | null; start: string | null };
  contact: { email: string | null; www: string | null; phone: string | null };
  status: { code: number | null; creditcode: number | null; start: string | null; end: string | null; bankrupt: boolean };
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
    period_start?: string | null;
    period_end?: string | null;
    first_period_start?: string | null;
    first_period_end?: string | null;
    revision?: boolean;
    documents?: AccountingDocument[];
    tax?: TaxRecord[];
  };
  employment?: {
    months?: {
      amount: number | null;
      amount_fte: number | null;
      interval_low: number | null;
      interval_high: number | null;
      interval_low_fte: number | null;
      interval_high_fte: number | null;
      year: number;
      month: number;
    }[];
  };
  info?: {
    capital_amount: number | null;
    capital_currency: string | null;
    capital_partial: boolean;
    capital_classes: boolean;
    capital_ipo: boolean;
    shareholder_below_5_percent: boolean;
    shareholder_public: boolean;
    articles_of_association: string | null;
    purpose: string | null;
    bind: string | null;
    modes_legislation_money_laundering: boolean;
    modes_social_economic: boolean;
    modes_government: boolean;
    demerges: unknown[];
    merges: unknown[];
    ean: unknown[];
  };
  secondarynames?: string[];
  subsidiaries?: Subsidiary[];
  participants?: Participant[];
  participations?: unknown[];
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
    "overview" | "financials" | "contact" | "people" | "ai-insights"
  >("overview");

  // AI features
  const emailClient = useEmailClientValue();
  const enrichmentMutation = useCompanyEnrichment();
  const { data: savedEnrichmentData } = useSavedEnrichment<CompanyEnrichment>("company", validVat);
  const enrichment = enrichmentMutation.data?.enrichment ?? savedEnrichmentData?.enrichment ?? null;
  // const briefingMutation = useCompanyBriefing();
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
  const [selectedFinancialYear, setSelectedFinancialYear] = useState(0);

  // Saved outreach messages
  const outreachMessages = useOutreachMessages(validVat);

  // Saved briefings (removed — using enrichment instead)

  // CRM Integration
  const activeConnections = useActiveConnections();
  const pushToCrm = usePushToCrm();
  const [showCrmMenu, setShowCrmMenu] = useState(false);
  const [crmToast, setCrmToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Note modal state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const [showQuickTask, setShowQuickTask] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskPriority, setQuickTaskPriority] = useState<"high" | "medium" | "low">("medium");
  const [quickTaskDue, setQuickTaskDue] = useState("");
  const [quickTaskToast, setQuickTaskToast] = useState("");

  const handleSaveToggle = () => {
    if (!company) return;
    if (isSaved) {
      unsaveMutation.mutate(vat);
    } else {
      setSaveNote("");
      setShowNoteModal(true);
    }
  };

  const handleConfirmSave = () => {
    if (!company) return;
    saveMutation.mutate(
      {
        vat: String(company.vat),
        name: company.life.name,
        rawData: company as unknown as Record<string, unknown>,
        note: saveNote.trim() || undefined,
      },
      {
        onSuccess: () => setShowNoteModal(false),
      }
    );
  };

  const ai = t.ai;
  const tabs = [
    { key: "overview" as const, label: cd.overview, icon: "info" },
    { key: "financials" as const, label: cd.financials, icon: "bar_chart" },
    { key: "contact" as const, label: cd.contact, icon: "call" },
    { key: "people" as const, label: cd.people, icon: "groups" },
    { key: "ai-insights" as const, label: ai.enrichment.tab, icon: "psychology" },
  ];

  // Financial data - filter documents that have actual summary data (not empty arrays)
  const financialDocs = (company?.accounting?.documents ?? []).filter(
    (d): d is AccountingDocument & { summary: AccountingSummary } =>
      d.summary != null && !Array.isArray(d.summary)
  );
  const selectedDoc = financialDocs[selectedFinancialYear];
  const accounting = selectedDoc?.summary;
  const empData = company?.employment?.months?.[0];
  const statusColor = company?.status?.bankrupt
    ? "bg-red-50 text-red-700"
    : company?.companystatus?.text === "NORMAL"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-700";

  return (
    <DashboardLayout>
      {/* Loading */}
      {loading && <InlineLoader message={cd.loading} />}

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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 md:mb-6 gap-3 md:gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center md:justify-start gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors w-full md:w-auto"
            >
              <span className="material-symbols-outlined text-lg">
                arrow_back
              </span>
              {cd.backToSearch}
            </button>
            <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
              <button
                onClick={() => setShowOutreach(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 w-full md:w-auto"
              >
                <span className="material-symbols-outlined text-lg">edit_note</span>
                {ai.outreach.button}
              </button>
              <button
                onClick={handleSaveToggle}
                disabled={saving}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer disabled:opacity-50 w-full md:w-auto ${
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

              <button
                onClick={() => { setShowQuickTask(true); setQuickTaskTitle(""); setQuickTaskPriority("medium"); setQuickTaskDue(""); }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 w-full md:w-auto"
              >
                <span className="material-symbols-outlined text-lg">task_alt</span>
                {locale === "da" ? "Opret opgave" : "Create task"}
              </button>

              {/* Push to CRM */}
              {activeConnections.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => !pushToCrm.isPending && setShowCrmMenu(!showCrmMenu)}
                    disabled={pushToCrm.isPending}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed w-full md:w-auto"
                  >
                    {pushToCrm.isPending ? (
                      <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-lg">sync</span>
                    )}
                    {pushToCrm.isPending
                      ? (locale === "da" ? "Sender..." : "Pushing...")
                      : t.integrations.pushToCrm}
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
                              {conn.provider === "hubspot" ? "hub" : conn.provider === "leadconnector" ? "rocket_launch" : "filter_alt"}
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
                    <span className="inline-flex px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
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
                  label={cd.fullAddress}
                  value={[
                    company.address?.street,
                    company.address?.numberfrom != null ? String(company.address.numberfrom) : null,
                    company.address?.floor ? `${cd.floor.toLowerCase()} ${company.address.floor}` : null,
                    company.address?.door ? `${cd.door.toLowerCase()} ${company.address.door}` : null,
                  ].filter(Boolean).join(" ") || null}
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
                <InfoRow
                  icon="public"
                  label={cd.country}
                  value={company.address?.countrycode}
                />
                {(company.address?.street || company.address?.cityname) && (
                  <div className="mt-3">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        [
                          company.address?.street,
                          company.address?.numberfrom != null ? String(company.address.numberfrom) : null,
                          company.address?.zipcode ? String(company.address.zipcode) : null,
                          company.address?.cityname,
                          company.address?.countrycode || "Denmark",
                        ].filter(Boolean).join(", ")
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">map</span>
                      {locale === "da" ? "Vis på Google Maps" : "View on Google Maps"}
                    </a>
                  </div>
                )}
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

                {company.info?.bind && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      {cd.signingRules}
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {company.info.bind}
                    </p>
                  </div>
                )}

                {company.info?.articles_of_association && (
                  <InfoRow
                    icon="description"
                    label={cd.articlesOfAssociation}
                    value={formatDate(company.info.articles_of_association, locale)}
                  />
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

                {/* Secondary names */}
                {company.secondarynames && company.secondarynames.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      {cd.secondaryNames}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {company.secondarynames.map((name, i) => (
                        <span
                          key={i}
                          className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-100"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Subsidiaries - shown below overview */}
          {activeTab === "overview" && company.subsidiaries && company.subsidiaries.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6 mt-6">
              <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-blue-600">
                  store
                </span>
                {cd.subsidiaries}
              </h2>
              <div className="divide-y divide-slate-50">
                {company.subsidiaries.map((sub) => (
                  <div key={sub.subsidiarynumber} className="flex items-start gap-3 py-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-slate-400 text-lg">
                        {sub.life.main ? "domain" : "apartment"}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900">
                          {sub.life.name}
                        </p>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          sub.life.main ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-500"
                        }`}>
                          {sub.life.main ? cd.mainBranch : cd.branch}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {[
                          sub.address?.street,
                          sub.address?.numberfrom != null ? String(sub.address.numberfrom) : null,
                        ].filter(Boolean).join(" ")}
                        {sub.address?.zipcode ? `, ${sub.address.zipcode} ${sub.address.cityname || ""}` : ""}
                      </p>
                      {sub.address?.municipalityname && (
                        <p className="text-xs text-slate-400">{sub.address.municipalityname}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "financials" && (
            <div className="space-y-6">
              {/* Year selector */}
              {financialDocs.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {financialDocs.map((doc, idx) => (
                    <button
                      key={`${doc.start}-${doc.end}`}
                      onClick={() => setSelectedFinancialYear(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        selectedFinancialYear === idx
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {doc.start?.slice(0, 4)}–{doc.end?.slice(0, 4)}
                    </button>
                  ))}
                </div>
              )}

              {/* Key financial metrics */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-blue-600">bar_chart</span>
                    {cd.financials}
                    {selectedDoc && (
                      <span className="text-xs font-normal text-slate-400 ml-1">
                        ({selectedDoc.start?.slice(0, 4)}–{selectedDoc.end?.slice(0, 4)})
                      </span>
                    )}
                  </h2>
                  {selectedDoc?.url && (
                    <a
                      href={selectedDoc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                      {cd.annualReport}
                    </a>
                  )}
                </div>
                {accounting ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { label: cd.revenue, value: accounting.revenue, icon: "trending_up" },
                      { label: cd.grossProfit, value: accounting.grossprofitloss, icon: "savings" },
                      { label: cd.profitLoss, value: accounting.profitloss, icon: "account_balance_wallet" },
                      { label: cd.equity, value: accounting.equity, icon: "account_balance" },
                      { label: cd.assets, value: accounting.assets, icon: "domain" },
                      { label: cd.employees, value: accounting.averagenumberofemployees, icon: "groups", isCount: true },
                      { label: cd.capital, value: accounting.contributedcapital, icon: "monetization_on" },
                      { label: locale === "da" ? "Omsætningsaktiver" : "Current assets", value: accounting.currentassets, icon: "wallet" },
                      { label: locale === "da" ? "Anlægsaktiver" : "Non-current assets", value: accounting.noncurrentassets, icon: "real_estate_agent" },
                      { label: locale === "da" ? "Gældsforpligtelser" : "Liabilities", value: accounting.liabilitiesotherthanprovisions, icon: "credit_card" },
                      { label: locale === "da" ? "Overført resultat" : "Retained earnings", value: accounting.retainedearnings, icon: "savings" },
                      { label: locale === "da" ? "Personaleomkostninger" : "Employee costs", value: accounting.employeebenefitsexpense, icon: "payments" },
                    ].filter(item => item.value != null).map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-100 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-lg text-slate-400">{item.icon}</span>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
                        </div>
                        <p className={`text-xl font-bold tabular-nums ${item.value != null && item.value < 0 ? "text-red-600" : "text-slate-900"}`}>
                          {"isCount" in item && item.isCount
                            ? (item.value?.toLocaleString(locale === "da" ? "da-DK" : "en-US") ?? "–")
                            : formatDKK(item.value, locale)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-200 mb-2 block">bar_chart</span>
                    <p className="text-slate-400 font-medium">{cd.noFinancials}</p>
                  </div>
                )}
              </div>

              {/* Financial Ratios */}
              {accounting && (accounting.operatingmargin != null || accounting.roi != null || accounting.liquidityratio != null || accounting.solvencyratio != null || accounting.equityreturn != null) && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                  <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-blue-600">analytics</span>
                    {cd.financialRatios}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[
                      { label: cd.operatingMargin, value: accounting.operatingmargin, suffix: "%" },
                      { label: cd.roi, value: accounting.roi, suffix: "%" },
                      { label: cd.liquidityRatio, value: accounting.liquidityratio, suffix: "%" },
                      { label: cd.solvencyRatio, value: accounting.solvencyratio, suffix: "%" },
                      { label: cd.equityReturn, value: accounting.equityreturn, suffix: "%" },
                    ].filter(item => item.value != null).map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-100 p-3 text-center">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{item.label}</p>
                        <p className={`text-lg font-bold tabular-nums ${item.value != null && item.value < 0 ? "text-red-600" : "text-slate-900"}`}>
                          {item.value != null ? `${item.value.toFixed(1)}${item.suffix}` : "–"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Accounting period info */}
              {company.accounting && (company.accounting.period_start || company.accounting.revision != null) && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                  <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-blue-600">event</span>
                    {cd.accountingPeriod}
                  </h2>
                  {company.accounting.period_start && company.accounting.period_end && (
                    <InfoRow
                      icon="date_range"
                      label={cd.accountingPeriod}
                      value={`${company.accounting.period_start.replace("--", "")} → ${company.accounting.period_end.replace("--", "")}`}
                    />
                  )}
                  {company.accounting.revision != null && (
                    <InfoRow
                      icon="verified"
                      label={cd.audited}
                      value={company.accounting.revision ? (locale === "da" ? "Ja" : "Yes") : (locale === "da" ? "Nej" : "No")}
                      badge={company.accounting.revision ? { text: "✓", color: "bg-emerald-50 text-emerald-700" } : null}
                    />
                  )}
                </div>
              )}

              {/* Annual Reports List */}
              {financialDocs.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                  <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-blue-600">folder_open</span>
                    {cd.annualReports}
                  </h2>
                  <div className="divide-y divide-slate-50">
                    {financialDocs.map((doc) => (
                      <div key={`${doc.start}-${doc.end}`} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="material-symbols-outlined text-lg text-red-400">picture_as_pdf</span>
                          <div>
                            <p className="text-sm font-medium text-slate-700">
                              {doc.type === "AARSRAPPORT" ? cd.annualReport : doc.type} {doc.start?.slice(0, 4)}–{doc.end?.slice(0, 4)}
                            </p>
                            {doc.publicdate && (
                              <p className="text-xs text-slate-400">
                                {locale === "da" ? "Offentliggjort" : "Published"}: {formatDate(doc.publicdate, locale)}
                              </p>
                            )}
                          </div>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                        >
                          <span className="material-symbols-outlined text-sm">download</span>
                          PDF
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tax Information */}
              {company.accounting?.tax && company.accounting.tax.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                  <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-blue-600">receipt_long</span>
                    {cd.taxInfo}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 py-2 pr-4">
                            {locale === "da" ? "År" : "Year"}
                          </th>
                          <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400 py-2 px-4">
                            {cd.taxableIncome}
                          </th>
                          <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400 py-2 px-4">
                            {cd.paidTax}
                          </th>
                          <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 py-2 pl-4">
                            {cd.companyType}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...company.accounting.tax].sort((a, b) => b.year - a.year).map((tax) => (
                          <tr key={tax.year} className="border-b border-slate-50 last:border-0">
                            <td className="py-2.5 pr-4 font-medium text-slate-700 tabular-nums">{tax.year}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-slate-700">{formatDKK(tax.taxableincome, locale)}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-slate-700">{formatDKK(tax.paidtax, locale)}</td>
                            <td className="py-2.5 pl-4 text-slate-500 text-xs">{tax.companytype || "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                    const roleLabels: Record<string, string> = {
                      founder: cd.founder,
                      director: cd.director,
                      owner: cd.owner,
                      real_owner: cd.realOwner,
                      accountant: cd.accountant,
                      board_member: cd.boardMember,
                      board: cd.boardMember,
                      supervisory_board: cd.supervisoryBoard,
                      daily_management: cd.dailyManagement,
                      branch_manager: cd.branchManager,
                      liquidator: cd.liquidator,
                      fully_responsible_participant: cd.fullyResponsible,
                    };
                    const roles: ParticipantRole[] = Array.isArray(p.roles)
                      ? p.roles
                      : p.roles && typeof p.roles === "object" && "type" in (p.roles as Record<string, unknown>)
                        ? [p.roles as ParticipantRole]
                        : [];
                    const personLink = p.company && p.vat
                      ? `/company/${p.vat}`
                      : p.participantnumber
                        ? `/person/${p.participantnumber}?fromVat=${vat}`
                        : null;
                    return (
                      <div
                        key={`${p.participantnumber || p.vat}-${idx}`}
                        className={`flex items-start gap-4 py-3.5 ${personLink ? "cursor-pointer group" : ""}`}
                        onClick={personLink ? () => router.push(personLink) : undefined}
                      >
                        <div
                          className={`w-10 h-10 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 ${personLink ? "group-hover:scale-105 transition-transform" : ""}`}
                        >
                          {p.company ? (
                            <span className="material-symbols-outlined text-sm text-white">business</span>
                          ) : initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-semibold text-slate-900 ${personLink ? "group-hover:text-blue-600 transition-colors" : ""}`}>
                              {p.life.name}
                            </p>
                            {p.life.deceased && (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-500">
                                {cd.deceased}
                              </span>
                            )}
                          </div>
                          {/* Profession */}
                          {p.life.profession && (
                            <p className="text-xs text-slate-500 mt-0.5">{p.life.profession}</p>
                          )}
                          {/* Roles with type, title, and dates */}
                          <div className="space-y-1.5 mt-1.5">
                            {roles.map((role, ri) => (
                              <div key={ri} className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    role.type === "owner" || role.type === "real_owner" ? "bg-amber-50 text-amber-700" :
                                    role.type === "director" || role.type === "daily_management" ? "bg-blue-50 text-blue-700" :
                                    role.type === "founder" ? "bg-violet-50 text-violet-700" :
                                    role.type === "accountant" ? "bg-emerald-50 text-emerald-700" :
                                    role.type === "board" || role.type === "board_member" || role.type === "supervisory_board" ? "bg-cyan-50 text-cyan-700" :
                                    role.type === "branch_manager" ? "bg-indigo-50 text-indigo-700" :
                                    role.type === "liquidator" ? "bg-red-50 text-red-700" :
                                    role.type === "fully_responsible_participant" ? "bg-orange-50 text-orange-700" :
                                    "bg-slate-50 text-slate-600"
                                  }`}
                                >
                                  {roleLabels[role.type] || role.type}
                                </span>
                                {role.life?.title && role.life.title !== (roleLabels[role.type] || role.type) && (
                                  <span className="text-xs font-medium text-slate-600">{role.life.title}</span>
                                )}
                                {role.life?.start && (
                                  <span className="text-xs text-slate-400">
                                    {formatDate(role.life.start, locale)}
                                    {role.life.end ? ` → ${formatDate(role.life.end, locale)}` : ` → ${locale === "da" ? "nu" : "present"}`}
                                  </span>
                                )}
                                {role.life?.owner_percent != null && (
                                  <span className="text-xs text-slate-500">
                                    · {cd.ownershipPercent}: <span className="font-semibold text-slate-700">{role.life.owner_percent}%</span>
                                    {role.life.owner_voting_percent != null && (
                                      <> · {cd.votingPercent}: <span className="font-semibold text-slate-700">{role.life.owner_voting_percent}%</span></>
                                    )}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          {/* Company participant info */}
                          {p.company && p.companyform && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {p.companyform.longdescription || p.companyform.description}
                            </p>
                          )}
                          {/* Address for participants who have one */}
                          {p.address?.cityname && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {[p.address.cityname, p.address.countrycode].filter(Boolean).join(", ")}
                            </p>
                          )}
                          {p.address?.freetext && !p.address?.cityname && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {p.address.freetext.replace(/\n/g, ", ")}
                            </p>
                          )}
                        </div>
                        {personLink && (
                          <span className="material-symbols-outlined text-lg text-slate-300 group-hover:text-blue-500 transition-colors shrink-0 mt-1">
                            open_in_new
                          </span>
                        )}
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

          {/* AI Insights Tab */}
          {activeTab === "ai-insights" && (() => {

            const er = ai.enrichment;
            const gradeColors: Record<string, string> = {
              A: "from-emerald-500 to-emerald-600 text-white",
              B: "from-blue-500 to-blue-600 text-white",
              C: "from-amber-400 to-amber-500 text-white",
              D: "from-slate-400 to-slate-500 text-white",
            };
            const healthColors: Record<string, string> = {
              growth: "bg-emerald-50 text-emerald-700",
              stable: "bg-blue-50 text-blue-700",
              declining: "bg-red-50 text-red-700",
            };

            return (
            <div className="space-y-6">
              {/* ── AI Enrichment Section ─── */}
              {!enrichment && !enrichmentMutation.isPending && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl text-white">psychology</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{er.noEnrichment}</h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">{er.noEnrichmentDesc}</p>
                  <button
                    onClick={() => enrichmentMutation.mutate({ vat, locale, companyData: company as unknown as Record<string, unknown> })}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">psychology</span>
                    {er.generate}
                  </button>
                </div>
              )}

              {enrichmentMutation.isPending && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-8 text-center">
                  <InlineLoader message={er.generating} />
                </div>
              )}

              {enrichment && (
                <div className="space-y-4">
                  {/* Lead Score + Financial Health — side by side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Lead Score */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">{er.leadScore}</h2>
                      <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradeColors[(enrichment.leadScore as Record<string, string>)?.grade] ?? gradeColors.C} flex items-center justify-center shadow-lg`}>
                          <span className="text-2xl font-black">{(enrichment.leadScore as Record<string, string>)?.grade ?? "C"}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {er[`grade${(enrichment.leadScore as Record<string, string>)?.grade ?? "C"}` as keyof typeof er] ?? er.gradeC}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            {(enrichment.leadScore as Record<string, string>)?.reason}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Financial Health */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">{er.financialHealth}</h2>
                      <div className="mb-3">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${healthColors[(enrichment.financialHealth as Record<string, string>)?.status] ?? healthColors.stable}`}>
                          {er[(enrichment.financialHealth as Record<string, string>)?.status as keyof typeof er] ?? er.stable}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {(enrichment.financialHealth as Record<string, string>)?.details}
                      </p>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-blue-500">description</span>
                      {er.summary}
                    </h2>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{enrichment.summary}</p>
                  </div>

                  {/* Buying Signals + Pain Points — side by side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(enrichment.buyingSignals as string[])?.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3 flex items-center gap-2">
                          <span className="material-symbols-outlined text-base">trending_up</span>
                          {er.buyingSignals}
                        </h2>
                        <ul className="space-y-2">
                          {(enrichment.buyingSignals as string[]).map((signal, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                              {signal}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(enrichment.painPoints as string[])?.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-3 flex items-center gap-2">
                          <span className="material-symbols-outlined text-base">warning</span>
                          {er.painPoints}
                        </h2>
                        <ul className="space-y-2">
                          {(enrichment.painPoints as string[]).map((point, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Risk Factors */}
                  {(enrichment.riskFactors as string[])?.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-red-50 p-5 sm:p-6">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">shield</span>
                        {er.riskFactors}
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {(enrichment.riskFactors as string[]).map((risk, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                            <span className="w-1 h-1 rounded-full bg-red-400" />
                            {risk}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitive Landscape */}
                  {enrichment.competitiveLandscape && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-violet-500">diversity_3</span>
                        {er.competitiveLandscape}
                      </h2>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{enrichment.competitiveLandscape as string}</p>
                    </div>
                  )}

                  {/* Ideal Approach */}
                  {enrichment.idealApproach && (
                    <div className="bg-white rounded-2xl shadow-sm border border-blue-50 p-5 sm:p-6">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">target</span>
                        {er.idealApproach}
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-blue-50/50">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">{er.channel}</p>
                          <p className="text-sm font-semibold text-blue-900 capitalize">{(enrichment.idealApproach as Record<string, string>)?.channel}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-50/50">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">{er.timing}</p>
                          <p className="text-sm font-semibold text-blue-900">{(enrichment.idealApproach as Record<string, string>)?.timing}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-50/50 sm:col-span-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">{er.angle}</p>
                          <p className="text-sm text-blue-900">{(enrichment.idealApproach as Record<string, string>)?.angle}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Key Insights */}
                  {(enrichment.keyInsights as string[])?.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 sm:p-6">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-cyan-500">lightbulb</span>
                        {er.keyInsights}
                      </h2>
                      <ul className="space-y-2">
                        {(enrichment.keyInsights as string[]).map((insight, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="material-symbols-outlined text-sm text-cyan-400 shrink-0 mt-0.5">check_circle</span>
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Regenerate + timestamp */}
                  <div className="flex items-center justify-between pt-2">
                    {enrichment.createdAt && (
                      <p className="text-[11px] text-slate-400">
                        {er.lastGenerated}: {new Date(enrichment.createdAt as string).toLocaleDateString(locale === "da" ? "da-DK" : "en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                    <button
                      onClick={() => enrichmentMutation.mutate({ vat, locale, companyData: company as unknown as Record<string, unknown> })}
                      disabled={enrichmentMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                      {er.regenerate}
                    </button>
                  </div>
                </div>
              )}

              {enrichmentMutation.isError && (
                <div className="bg-red-50 rounded-2xl p-5 text-center">
                  <p className="text-sm text-red-600 font-medium">{er.error}</p>
                </div>
              )}

              {/* ── Suggest Tasks (shown when enrichment exists) ─── */}
              {enrichment && (
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
                                {msg.type === "email" && (
                                  <div className="pt-3">
                                    <a
                                      href={buildComposeUrl(emailClient, company.contact?.email, msg.subject, msg.message)}
                                      target={emailClient !== "default" ? "_blank" : undefined}
                                      rel={emailClient !== "default" ? "noopener noreferrer" : undefined}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors"
                                    >
                                      <span className="material-symbols-outlined text-sm">mail</span>
                                      {ai.outreach.openInEmail}
                                    </a>
                                  </div>
                                )}
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
                            {outreachType === "email" && (
                              <a
                                href={buildComposeUrl(
                                  emailClient,
                                  company.contact?.email,
                                  outreachMutation.data.subject,
                                  outreachMutation.data.message
                                )}
                                target={emailClient !== "default" ? "_blank" : undefined}
                                rel={emailClient !== "default" ? "noopener noreferrer" : undefined}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase hover:bg-blue-100 transition-colors"
                              >
                                <span className="material-symbols-outlined text-xs">mail</span>
                                {ai.outreach.openInEmail}
                              </a>
                            )}
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
      {/* Save with note modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowNoteModal(false)}
          />
          <div className="relative bg-white w-full sm:rounded-2xl rounded-t-2xl shadow-2xl sm:max-w-md flex flex-col animate-[slideUp_0.2s_ease-out] sm:animate-[fadeIn_0.15s_ease-out]">
            <div className="px-5 pt-5 pb-0 sm:px-6 sm:pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-blue-600 text-xl">bookmark</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{cd.save}</h3>
                  <p className="text-xs text-slate-400">{cd.noteOptional}</p>
                </div>
              </div>
              <textarea
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none resize-none transition-colors"
                rows={3}
                value={saveNote}
                onChange={(e) => setSaveNote(e.target.value)}
                placeholder={cd.notePlaceholder}
                maxLength={500}
                autoFocus
              />
              <div className="flex justify-end mt-1 mb-1">
                <span className="text-[10px] text-slate-300 tabular-nums">{saveNote.length}/500</span>
              </div>
            </div>
            <div className="px-5 pb-5 pt-2 sm:px-6 sm:pb-6 flex gap-2">
              <button
                onClick={() => setShowNoteModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {cd.cancelNote}
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={saveMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-base">bookmark</span>
                )}
                {saveMutation.isPending ? "..." : cd.save}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Quick Task toast */}
      {quickTaskToast && (
        <div className="fixed top-6 right-6 z-50 bg-foreground text-background px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
          {quickTaskToast}
        </div>
      )}

      {/* Quick Task dialog */}
      {showQuickTask && company && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowQuickTask(false)} />
          <div className="relative bg-white w-full sm:rounded-2xl rounded-t-2xl shadow-2xl sm:max-w-md flex flex-col animate-[slideUp_0.2s_ease-out] sm:animate-[fadeIn_0.15s_ease-out]">
            <div className="px-5 pt-5 sm:px-6 sm:pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-emerald-600 text-xl">task_alt</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {locale === "da" ? "Opret opgave" : "Create task"}
                  </h3>
                  <p className="text-xs text-slate-400">{company.life.name}</p>
                </div>
              </div>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none transition-colors mb-3"
                value={quickTaskTitle}
                onChange={(e) => setQuickTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && quickTaskTitle.trim()) {
                    createTodoMutation.mutate(
                      { title: quickTaskTitle.trim(), priority: quickTaskPriority, dueDate: quickTaskDue || null, cvr: vat },
                      { onSuccess: () => { setShowQuickTask(false); setQuickTaskToast(locale === "da" ? "Opgave oprettet" : "Task created"); setTimeout(() => setQuickTaskToast(""), 3000); } }
                    );
                  }
                }}
                placeholder={locale === "da" ? "Hvad skal gøres?" : "What needs to be done?"}
                autoFocus
              />
              <div className="flex bg-slate-50 rounded-full p-1 gap-1 mb-3">
                {(["high", "medium", "low"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setQuickTaskPriority(p)}
                    className={`flex-1 py-2 rounded-full text-xs font-bold transition-all cursor-pointer capitalize ${
                      quickTaskPriority === p
                        ? p === "high" ? "bg-red-500 text-white shadow-sm" : p === "medium" ? "bg-amber-500 text-white shadow-sm" : "bg-emerald-500 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {p === "high" ? (locale === "da" ? "Høj" : "High") : p === "medium" ? "Medium" : (locale === "da" ? "Lav" : "Low")}
                  </button>
                ))}
              </div>
              <input
                type="date"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none transition-colors"
                value={quickTaskDue}
                onChange={(e) => setQuickTaskDue(e.target.value)}
              />
            </div>
            <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6 flex gap-2">
              <button
                onClick={() => setShowQuickTask(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {locale === "da" ? "Annuller" : "Cancel"}
              </button>
              <button
                onClick={() => {
                  if (!quickTaskTitle.trim()) return;
                  createTodoMutation.mutate(
                    { title: quickTaskTitle.trim(), priority: quickTaskPriority, dueDate: quickTaskDue || null, cvr: vat },
                    { onSuccess: () => { setShowQuickTask(false); setQuickTaskToast(locale === "da" ? "Opgave oprettet" : "Task created"); setTimeout(() => setQuickTaskToast(""), 3000); } }
                  );
                }}
                disabled={!quickTaskTitle.trim() || createTodoMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
              >
                {createTodoMutation.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {locale === "da" ? "Opret" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
