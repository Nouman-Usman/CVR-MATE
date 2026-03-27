"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { useParticipant } from "@/lib/hooks/use-participant";

interface CompanyRelation {
  vat: number;
  slug: string;
  life: { name: string; start?: string | null; end?: string | null };
  companystatus?: { text: string | null };
  companyform?: { description: string | null };
  industry?: { primary?: { code: number | null; text: string | null } };
  address?: { cityname?: string | null; zipcode?: number | null };
  roles: {
    type: string;
    life: {
      start?: string | null;
      end?: string | null;
      title?: string | null;
      owner_percent?: number | null;
      owner_voting_percent?: number | null;
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

const companyColors = [
  "from-blue-500 to-cyan-400",
  "from-violet-500 to-purple-400",
  "from-amber-500 to-orange-400",
  "from-emerald-500 to-teal-400",
  "from-rose-500 to-pink-400",
  "from-indigo-500 to-blue-400",
];

export default function PersonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useLanguage();
  const pd = t.personDetail;
  const id = params.id as string;

  const validId = id && /^\d+$/.test(id) ? id : undefined;
  const {
    data: participantData,
    isLoading: loading,
    error: fetchError,
  } = useParticipant(validId);

  const person = participantData?.participant ?? null;
  const error = !validId ? pd.notFound : fetchError ? pd.error : "";

  const [showHistorical, setShowHistorical] = useState(false);

  const roleLabels: Record<string, string> = {
    founder: pd.founder,
    director: pd.director,
    owner: pd.owner,
    accountant: pd.accountant,
    board_member: pd.boardMember,
    board: pd.boardMember,
  };

  const roleColors: Record<string, string> = {
    owner: "bg-amber-50 text-amber-700 border-amber-200",
    director: "bg-blue-50 text-blue-700 border-blue-200",
    founder: "bg-violet-50 text-violet-700 border-violet-200",
    accountant: "bg-emerald-50 text-emerald-700 border-emerald-200",
    board: "bg-cyan-50 text-cyan-700 border-cyan-200",
    board_member: "bg-cyan-50 text-cyan-700 border-cyan-200",
  };

  // Split companies into active and historical
  const companies = (person?.companies ?? []) as CompanyRelation[];
  const activeCompanies = companies.filter((c) =>
    c.roles.some((r) => !r.life.end)
  );
  const historicalCompanies = companies.filter(
    (c) => !c.roles.some((r) => !r.life.end)
  );

  return (
    <DashboardLayout>
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-4 cursor-pointer"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        {pd.backToCompany}
      </button>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-20 text-center">
          <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-slate-400 font-medium">{pd.loading}</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-20 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-200 mb-3 block">
            error
          </span>
          <p className="text-slate-400 font-medium">{error}</p>
        </div>
      )}

      {/* Person profile */}
      {!loading && !error && person && (
        <>
          {/* Header card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 overflow-hidden mb-6">
            {/* Gradient banner */}
            <div className="h-20 sm:h-24 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400" />

            <div className="px-5 sm:px-8 pb-6 -mt-8 sm:-mt-10">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                {/* Avatar */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white shadow-lg border-4 border-white flex items-center justify-center shrink-0">
                  {person.company ? (
                    <span className="material-symbols-outlined text-2xl sm:text-3xl text-slate-400">
                      business
                    </span>
                  ) : (
                    <span className="text-lg sm:text-2xl font-bold text-blue-600">
                      {person.life.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight font-[family-name:var(--font-manrope)] truncate">
                      {person.life.name}
                    </h1>
                    {person.life.deceased && (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-500">
                        {pd.deceased}
                      </span>
                    )}
                    {person.life.adprotected && (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-600">
                        {pd.adProtected}
                      </span>
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm text-slate-400">
                    {person.life.profession && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">work</span>
                        {person.life.profession}
                      </span>
                    )}
                    {person.address?.cityname && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">location_on</span>
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
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">location_on</span>
                        {person.address.freetext.replace(/\n/g, ", ")}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">badge</span>
                      #{person.participantnumber}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Active relations */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-blue-600">
                business_center
              </span>
              {pd.activeRoles}
              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">
                {activeCompanies.length}
              </span>
            </h2>

            {activeCompanies.length > 0 ? (
              <div className="space-y-3">
                {activeCompanies.map((company, idx) => (
                  <CompanyRelationCard
                    key={company.vat}
                    company={company}
                    colorIdx={idx}
                    locale={locale}
                    roleLabels={roleLabels}
                    roleColors={roleColors}
                    pd={pd}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-10 text-center">
                <p className="text-slate-400 text-sm">{pd.noRelations}</p>
              </div>
            )}
          </div>

          {/* Historical relations */}
          {historicalCompanies.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistorical(!showHistorical)}
                className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2 cursor-pointer hover:text-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-lg text-slate-400">
                  history
                </span>
                {pd.historicalRoles}
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                  {historicalCompanies.length}
                </span>
                <span
                  className={`material-symbols-outlined text-lg text-slate-400 transition-transform duration-200 ${
                    showHistorical ? "rotate-180" : ""
                  }`}
                >
                  expand_more
                </span>
              </button>

              {showHistorical && (
                <div className="space-y-3">
                  {historicalCompanies.map((company, idx) => (
                    <CompanyRelationCard
                      key={company.vat}
                      company={company}
                      colorIdx={idx + activeCompanies.length}
                      locale={locale}
                      roleLabels={roleLabels}
                      roleColors={roleColors}
                      pd={pd}
                      historical
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

function CompanyRelationCard({
  company,
  colorIdx,
  locale,
  roleLabels,
  roleColors,
  pd,
  historical,
}: {
  company: CompanyRelation;
  colorIdx: number;
  locale: string;
  roleLabels: Record<string, string>;
  roleColors: Record<string, string>;
  pd: Record<string, string>;
  historical?: boolean;
}) {
  const grad = companyColors[colorIdx % companyColors.length];
  const initials = company.life.name
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const statusActive =
    company.companystatus?.text?.toLowerCase().includes("aktiv") ||
    company.companystatus?.text?.toLowerCase().includes("normal");

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-shadow hover:shadow-md ${
        historical
          ? "border-slate-100/60 opacity-80"
          : "border-slate-100/60"
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Company avatar */}
          <div
            className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-bold shrink-0`}
          >
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            {/* Company name + status */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/company/${company.vat}`}
                className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors truncate"
              >
                {company.life.name}
              </Link>
              {company.companystatus?.text && (
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    statusActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {company.companystatus.text}
                </span>
              )}
            </div>

            {/* Company meta */}
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
              <span className="tabular-nums">CVR {company.vat}</span>
              {company.companyform?.description && (
                <>
                  <span>·</span>
                  <span>{company.companyform.description}</span>
                </>
              )}
              {company.industry?.primary?.text && (
                <>
                  <span>·</span>
                  <span className="truncate max-w-[180px]">
                    {company.industry.primary.text}
                  </span>
                </>
              )}
              {company.address?.cityname && (
                <>
                  <span>·</span>
                  <span>{company.address.cityname}</span>
                </>
              )}
            </div>

            {/* Roles */}
            <div className="mt-2.5 space-y-1.5">
              {company.roles.map((role, ri) => {
                const isActive = !role.life.end;
                return (
                  <div key={ri} className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        roleColors[role.type] ||
                        "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {roleLabels[role.type] || role.type}
                    </span>
                    {role.life?.title &&
                      role.life.title !==
                        (roleLabels[role.type] || role.type) && (
                        <span className="text-xs font-medium text-slate-600">
                          {role.life.title}
                        </span>
                      )}
                    {role.life?.start && (
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {formatDate(role.life.start, locale)}
                        {role.life.end
                          ? ` → ${formatDate(role.life.end, locale)}`
                          : ` → ${locale === "da" ? "nu" : "present"}`}
                      </span>
                    )}
                    {role.life?.owner_percent != null && (
                      <span className="text-[11px] text-slate-500">
                        · {pd.ownershipPercent}:{" "}
                        <span className="font-semibold text-slate-700">
                          {role.life.owner_percent}%
                        </span>
                        {role.life.owner_voting_percent != null && (
                          <>
                            {" "}
                            · {pd.votingPercent}:{" "}
                            <span className="font-semibold text-slate-700">
                              {role.life.owner_voting_percent}%
                            </span>
                          </>
                        )}
                      </span>
                    )}
                    {isActive && (
                      <span className="inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* View company button */}
          <Link
            href={`/company/${company.vat}`}
            className="p-2 rounded-lg text-slate-300 hover:bg-slate-50 hover:text-blue-600 transition-colors shrink-0 cursor-pointer"
            title={pd.viewCompany}
          >
            <span className="material-symbols-outlined text-lg">
              open_in_new
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
