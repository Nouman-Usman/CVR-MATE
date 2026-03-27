"use client";

import { useState, useMemo, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { useParticipant } from "@/lib/hooks/use-participant";

// Matches CvrParticipation from lib/cvr-api.ts (official CVR API v2 Participations schema)
interface CompanyRelation {
  vat: number;
  slug: string;
  life: { name: string; start?: string | null; end?: string | null; adprotected?: boolean };
  companystatus?: { text: string | null; start?: string | null };
  companyform?: { code?: number | null; description: string | null; longdescription?: string | null; holding?: boolean };
  roles: {
    type: string; // accountant | board | branch_manager | daily_management | director | founder | fully_responsible_participant | liquidator | owner | real_owner | supervisory_board
    life: {
      start?: string | null;
      end?: string | null;
      title?: string | null;
      owner_percent?: number | null;
      owner_voting_percent?: number | null;
      special_ownership?: string | null;
      special_ownership_description?: string | null;
    };
  }[];
}

function formatDate(
  dateStr: string | null | undefined,
  locale: string
): string {
  if (!dateStr) return "–";
  return new Date(dateStr).toLocaleDateString(
    locale === "da" ? "da-DK" : "en-US",
    { year: "numeric", month: "short", day: "numeric" }
  );
}

const avatarGradients = [
  "from-blue-600 to-cyan-500",
  "from-violet-600 to-purple-500",
  "from-amber-500 to-orange-400",
  "from-emerald-600 to-teal-500",
  "from-rose-500 to-pink-400",
  "from-indigo-600 to-blue-500",
];

const ROLE_CONFIG: Record<string, { bg: string; text: string; icon: string }> = {
  owner:                          { bg: "bg-amber-50",   text: "text-amber-700",   icon: "shield_person" },
  real_owner:                     { bg: "bg-amber-50",   text: "text-amber-700",   icon: "verified_user" },
  director:                       { bg: "bg-blue-50",    text: "text-blue-700",    icon: "supervisor_account" },
  founder:                        { bg: "bg-violet-50",  text: "text-violet-700",  icon: "star" },
  accountant:                     { bg: "bg-emerald-50", text: "text-emerald-700", icon: "calculate" },
  board:                          { bg: "bg-cyan-50",    text: "text-cyan-700",    icon: "groups" },
  board_member:                   { bg: "bg-cyan-50",    text: "text-cyan-700",    icon: "groups" },
  supervisory_board:              { bg: "bg-cyan-50",    text: "text-cyan-700",    icon: "groups" },
  daily_management:               { bg: "bg-blue-50",    text: "text-blue-700",    icon: "manage_accounts" },
  branch_manager:                 { bg: "bg-indigo-50",  text: "text-indigo-700",  icon: "store" },
  liquidator:                     { bg: "bg-red-50",     text: "text-red-700",     icon: "gavel" },
  fully_responsible_participant:  { bg: "bg-orange-50",  text: "text-orange-700",  icon: "person_pin" },
};

const DEFAULT_ROLE = { bg: "bg-slate-50", text: "text-slate-600", icon: "badge" };

export default function PersonDetailPage() {
  return (
    <Suspense>
      <PersonDetailContent />
    </Suspense>
  );
}

function PersonDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useLanguage();
  const pd = t.personDetail;
  const id = params.id as string;
  const fromVat = searchParams.get("fromVat") ?? undefined;

  const validId = id && /^\d+$/.test(id) ? id : undefined;
  const {
    data: participantData,
    isLoading: loading,
    error: fetchError,
  } = useParticipant(validId, fromVat);

  const person = participantData?.participant ?? null;
  const error = !validId ? pd.notFound : fetchError ? pd.error : "";

  const [showHistorical, setShowHistorical] = useState(false);

  const roleLabels: Record<string, string> = {
    founder: pd.founder,
    director: pd.director,
    owner: pd.owner,
    real_owner: pd.realOwner,
    accountant: pd.accountant,
    board_member: pd.boardMember,
    board: pd.boardMember,
    supervisory_board: pd.supervisoryBoard,
    daily_management: pd.dailyManagement,
    branch_manager: pd.branchManager,
    liquidator: pd.liquidator,
    fully_responsible_participant: pd.fullyResponsible,
  };

  // Split companies into active and historical
  const companies = (person?.companies ?? []) as CompanyRelation[];
  const { activeCompanies, historicalCompanies } = useMemo(() => {
    const active: CompanyRelation[] = [];
    const historical: CompanyRelation[] = [];
    for (const c of companies) {
      if (c.roles.some((r) => !r.life.end)) active.push(c);
      else historical.push(c);
    }
    return { activeCompanies: active, historicalCompanies: historical };
  }, [companies]);

  // Count unique role types across active companies
  const totalActiveRoles = useMemo(
    () => activeCompanies.reduce((sum, c) => sum + c.roles.filter((r) => !r.life.end).length, 0),
    [activeCompanies]
  );

  const initials = person?.life.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "";

  return (
    <DashboardLayout>
      {/* Back navigation */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-600 transition-colors mb-5 cursor-pointer group"
      >
        <span className="material-symbols-outlined text-lg group-hover:-translate-x-0.5 transition-transform">
          arrow_back
        </span>
        {pd.backToCompany}
      </button>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="bg-white rounded-2xl h-48" />
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl h-24" />
            <div className="bg-white rounded-2xl h-24" />
            <div className="bg-white rounded-2xl h-24" />
          </div>
          <div className="bg-white rounded-2xl h-40" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-white rounded-2xl py-20 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-200 mb-3 block">
            person_off
          </span>
          <p className="text-slate-400 font-medium">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-5 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
          >
            {pd.backToCompany}
          </button>
        </div>
      )}

      {/* Person profile */}
      {!loading && !error && person && (
        <div className="space-y-5 animate-fade-in-up">
          {/* ─── Header Card ─── */}
          <div className="bg-white rounded-2xl overflow-hidden">
            {/* Thin gradient accent */}
            <div className="h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400" />

            <div className="p-5 sm:p-7">
              <div className="flex flex-col sm:flex-row gap-5">
                {/* Avatar */}
                <div className="shrink-0">
                  <div className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-600/10">
                    {initials ? (
                      <span className="text-xl sm:text-2xl font-bold text-white tracking-tight font-[family-name:var(--font-manrope)]">
                        {initials}
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-3xl text-white">
                        person
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  {/* Name + badges */}
                  <div className="flex items-start gap-2.5 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight font-[family-name:var(--font-manrope)] leading-tight">
                      {person.life.name}
                    </h1>
                    {person.life.deceased && (
                      <span className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                        <span className="material-symbols-outlined text-[11px]">do_not_disturb_on</span>
                        {pd.deceased}
                      </span>
                    )}
                    {person.address?.unlisted && (
                      <span className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                        <span className="material-symbols-outlined text-[11px]">shield</span>
                        {pd.adProtected}
                      </span>
                    )}
                  </div>

                  {/* Meta pills */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {person.life.profession && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-xs font-medium text-slate-600">
                        <span className="material-symbols-outlined text-sm text-slate-400">work</span>
                        {person.life.profession}
                      </span>
                    )}
                    {person.address?.cityname && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-xs font-medium text-slate-600">
                        <span className="material-symbols-outlined text-sm text-slate-400">location_on</span>
                        {[
                          person.address.cityname,
                          person.address.countrycode && person.address.countrycode !== "DK"
                            ? person.address.countrycode
                            : null,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    )}
                    {person.address?.freetext && !person.address?.cityname && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-xs font-medium text-slate-600">
                        <span className="material-symbols-outlined text-sm text-slate-400">location_on</span>
                        {person.address.freetext.replace(/\n/g, ", ")}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-xs font-medium text-slate-500 tabular-nums">
                      <span className="material-symbols-outlined text-sm text-slate-400">tag</span>
                      {person.participantnumber}
                    </span>
                    {person.contact?.email && (
                      <a
                        href={`mailto:${person.contact.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">mail</span>
                        {person.contact.email}
                      </a>
                    )}
                    {person.contact?.phone && (
                      <a
                        href={`tel:${person.contact.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm text-slate-400">phone</span>
                        {person.contact.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Quick Stats ─── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 sm:p-5 text-center">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-50 mb-2.5">
                <span className="material-symbols-outlined text-lg text-emerald-600">verified</span>
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums font-[family-name:var(--font-manrope)]">
                {totalActiveRoles}
              </p>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">
                {pd.activeRoles}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 sm:p-5 text-center">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 mb-2.5">
                <span className="material-symbols-outlined text-lg text-blue-600">apartment</span>
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums font-[family-name:var(--font-manrope)]">
                {companies.length}
              </p>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">
                {pd.relations}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 sm:p-5 text-center">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 mb-2.5">
                <span className="material-symbols-outlined text-lg text-slate-500">history</span>
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums font-[family-name:var(--font-manrope)]">
                {historicalCompanies.length}
              </p>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">
                {pd.historicalRoles}
              </p>
            </div>
          </div>

          {/* ─── Active Relations ─── */}
          <div>
            <div className="flex items-center gap-2.5 mb-3 px-1">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50">
                <span className="material-symbols-outlined text-base text-blue-600">business_center</span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 font-[family-name:var(--font-manrope)]">
                {pd.activeRoles}
              </h2>
              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 tabular-nums">
                {activeCompanies.length}
              </span>
            </div>

            {activeCompanies.length > 0 ? (
              <div className="space-y-3">
                {activeCompanies.map((company, idx) => (
                  <CompanyRelationCard
                    key={company.vat}
                    company={company}
                    colorIdx={idx}
                    locale={locale}
                    roleLabels={roleLabels}
                    pd={pd}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl py-12 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-200 mb-2 block">
                  domain_disabled
                </span>
                <p className="text-sm text-slate-400">{pd.noRelations}</p>
              </div>
            )}
          </div>

          {/* ─── Historical Relations ─── */}
          {historicalCompanies.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistorical(!showHistorical)}
                className="flex items-center gap-2.5 mb-3 px-1 cursor-pointer group w-full text-left"
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100">
                  <span className="material-symbols-outlined text-base text-slate-500">history</span>
                </div>
                <h2 className="text-sm font-bold text-slate-900 font-[family-name:var(--font-manrope)] group-hover:text-slate-700 transition-colors">
                  {pd.historicalRoles}
                </h2>
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 tabular-nums">
                  {historicalCompanies.length}
                </span>
                <span
                  className={`material-symbols-outlined text-lg text-slate-400 ml-auto transition-transform duration-200 ${
                    showHistorical ? "rotate-180" : ""
                  }`}
                >
                  expand_more
                </span>
              </button>

              {showHistorical && (
                <div className="space-y-3 animate-fade-in-up">
                  {historicalCompanies.map((company, idx) => (
                    <CompanyRelationCard
                      key={company.vat}
                      company={company}
                      colorIdx={idx + activeCompanies.length}
                      locale={locale}
                      roleLabels={roleLabels}
                      pd={pd}
                      historical
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

/* ─── Company Relation Card ─── */

function CompanyRelationCard({
  company,
  colorIdx,
  locale,
  roleLabels,
  pd,
  historical,
}: {
  company: CompanyRelation;
  colorIdx: number;
  locale: string;
  roleLabels: Record<string, string>;
  pd: Record<string, string>;
  historical?: boolean;
}) {
  const grad = avatarGradients[colorIdx % avatarGradients.length];
  const initials = company.life.name
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const statusText = company.companystatus?.text ?? "";
  const statusActive =
    statusText.toLowerCase().includes("aktiv") ||
    statusText.toLowerCase().includes("normal");

  const activeRoles = company.roles.filter((r) => !r.life.end);
  const pastRoles = company.roles.filter((r) => r.life.end);
  const displayRoles = historical ? company.roles : [...activeRoles, ...pastRoles];

  return (
    <Link
      href={`/company/${company.vat}`}
      className={`block bg-white rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-blue-600/[0.04] hover:-translate-y-0.5 group ${
        historical ? "opacity-70 hover:opacity-100" : ""
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          {/* Company avatar */}
          <div
            className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm`}
          >
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            {/* Name row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                {company.life.name}
              </span>
              {statusText && (
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    statusActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {statusText}
                </span>
              )}
            </div>

            {/* Company meta */}
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400 flex-wrap">
              <span className="tabular-nums font-medium">CVR {company.vat}</span>
              {company.companyform?.description && (
                <>
                  <span className="text-slate-200">·</span>
                  <span>{company.companyform.description}</span>
                </>
              )}
            </div>

            {/* Roles */}
            <div className="mt-3 space-y-2">
              {displayRoles.map((role, ri) => {
                const isActive = !role.life.end;
                const config = ROLE_CONFIG[role.type] || DEFAULT_ROLE;
                return (
                  <div key={ri} className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${config.bg} ${config.text}`}
                    >
                      <span className="material-symbols-outlined text-[11px]">{config.icon}</span>
                      {roleLabels[role.type] || role.type}
                    </span>
                    {role.life?.title &&
                      role.life.title !== (roleLabels[role.type] || role.type) && (
                        <span className="text-xs font-medium text-slate-600">
                          {role.life.title}
                        </span>
                      )}
                    {role.life?.start && (
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {formatDate(role.life.start, locale)}
                        <span className="mx-1 text-slate-200">→</span>
                        {role.life.end
                          ? formatDate(role.life.end, locale)
                          : (locale === "da" ? "nu" : "present")}
                      </span>
                    )}
                    {role.life?.owner_percent != null && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        <span className="text-slate-200">·</span>
                        {pd.ownershipPercent}:
                        <span className="font-semibold text-slate-700">
                          {role.life.owner_percent}%
                        </span>
                        {role.life.owner_voting_percent != null && (
                          <>
                            <span className="text-slate-200">·</span>
                            {pd.votingPercent}:
                            <span className="font-semibold text-slate-700">
                              {role.life.owner_voting_percent}%
                            </span>
                          </>
                        )}
                      </span>
                    )}
                    {isActive && (
                      <span className="inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Arrow */}
          <span className="material-symbols-outlined text-lg text-slate-200 group-hover:text-blue-500 transition-colors shrink-0 mt-1">
            arrow_forward
          </span>
        </div>
      </div>
    </Link>
  );
}
