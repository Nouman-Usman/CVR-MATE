"use client";

import { useState, useMemo, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { InlineLoader } from "@/components/loading-screen";
import { useParticipant } from "@/lib/hooks/use-participant";
import {
  useFollowedParticipantSet,
  useFollowPerson,
  useUnfollowPerson,
} from "@/lib/hooks/use-followed-people";
import { usePersonEnrichment, useSavedEnrichment, type PersonEnrichment } from "@/lib/hooks/use-enrichment";

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

  // Follow state
  const followedSet = useFollowedParticipantSet();
  const isFollowed = validId ? followedSet.has(validId) : false;
  const followMutation = useFollowPerson();
  const unfollowMutation = useUnfollowPerson();
  const isFollowLoading = followMutation.isPending || unfollowMutation.isPending;

  const handleToggleFollow = () => {
    if (!validId || !person) return;
    if (isFollowed) {
      unfollowMutation.mutate(validId);
    } else {
      followMutation.mutate(
        {
          participantNumber: validId,
          personName: person.life.name,
          fromVat,
        },
        {
          onError: (err) => {
            const e = err as Error & { upgrade?: boolean };
            if (e.upgrade) {
              // Could show a toast/modal — for now, alert
              alert(pd.followLimitReached);
            }
          },
        }
      );
    }
  };

  // AI Enrichment
  const personEnrichmentMutation = usePersonEnrichment();
  const { data: savedPersonEnrichment } = useSavedEnrichment<PersonEnrichment>("person", validId);
  const personEnrichment = personEnrichmentMutation.data?.enrichment ?? savedPersonEnrichment?.enrichment ?? null;
  const [showEnrichment, setShowEnrichment] = useState(true);

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

  // Count total active roles across all companies (a person can have multiple roles per company)
  const totalActiveRoles = useMemo(
    () => activeCompanies.reduce((sum, c) => sum + c.roles.filter((r) => !r.life.end).length, 0),
    [activeCompanies]
  );
  // Count total historical roles
  const totalHistoricalRoles = useMemo(
    () => historicalCompanies.reduce((sum, c) => sum + c.roles.filter((r) => !!r.life.end).length, 0),
    [historicalCompanies]
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
      {loading && <InlineLoader />}

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
                    {/* Follow/Unfollow button */}
                    <button
                      onClick={handleToggleFollow}
                      disabled={isFollowLoading}
                      className={`mt-0.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                        isFollowed
                          ? "bg-blue-50 text-blue-600 border border-blue-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                          : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-transparent"
                      } ${isFollowLoading ? "opacity-50 cursor-wait" : ""}`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {isFollowLoading ? "hourglass_empty" : isFollowed ? "person_check" : "person_add"}
                      </span>
                      {isFollowed ? pd.following : pd.follow}
                    </button>
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
                {totalHistoricalRoles}
              </p>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">
                {pd.historicalRoles}
              </p>
            </div>
          </div>

          {/* ─── AI Insights ─── */}
          <div>
            <button
              onClick={() => setShowEnrichment(!showEnrichment)}
              className="flex items-center gap-2.5 mb-3 px-1 cursor-pointer group w-full text-left"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                <span className="material-symbols-outlined text-base text-white">psychology</span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 font-[family-name:var(--font-manrope)]">
                {t.ai.enrichment.tab}
              </h2>
              <span className={`material-symbols-outlined text-lg text-slate-400 ml-auto transition-transform duration-200 ${showEnrichment ? "rotate-180" : ""}`}>
                expand_more
              </span>
            </button>

            {showEnrichment && (
              <div className="space-y-3">
                {/* Generate CTA */}
                {!personEnrichment && !personEnrichmentMutation.isPending && (
                  <div className="bg-white rounded-2xl p-6 text-center">
                    <p className="text-sm text-slate-500 mb-4">{t.ai.enrichment.noEnrichmentDesc}</p>
                    <button
                      onClick={() => {
                        if (!validId || !person) return;
                        personEnrichmentMutation.mutate({
                          participantNumber: validId,
                          personName: person.life.name,
                          locale,
                          personData: person as unknown as Record<string, unknown>,
                          companies: companies as unknown as Record<string, unknown>[],
                        });
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/20 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">psychology</span>
                      {t.ai.enrichment.enrichCta}
                    </button>
                  </div>
                )}

                {personEnrichmentMutation.isPending && <InlineLoader message={t.ai.enrichment.generating} />}

                {personEnrichment && (
                  <>
                    {/* Summary */}
                    <div className="bg-white rounded-2xl p-5">
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{personEnrichment.summary}</p>
                    </div>

                    {/* Role Significance + Network Influence */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-white rounded-2xl p-5">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{t.ai.enrichment.roleSignificance}</h3>
                        <p className="text-sm text-slate-700 leading-relaxed">{personEnrichment.roleSignificance}</p>
                      </div>
                      <div className="bg-white rounded-2xl p-5">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{t.ai.enrichment.networkInfluence}</h3>
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase mb-2 ${
                          (personEnrichment.networkInfluence as Record<string, string>)?.score === "high" ? "bg-emerald-50 text-emerald-700"
                            : (personEnrichment.networkInfluence as Record<string, string>)?.score === "low" ? "bg-slate-100 text-slate-600"
                              : "bg-blue-50 text-blue-700"
                        }`}>
                          {(personEnrichment.networkInfluence as Record<string, string>)?.score}
                        </span>
                        <p className="text-sm text-slate-700 leading-relaxed">{(personEnrichment.networkInfluence as Record<string, string>)?.details}</p>
                      </div>
                    </div>

                    {/* Career Trajectory */}
                    <div className="bg-white rounded-2xl p-5">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{t.ai.enrichment.careerTrajectory}</h3>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase mb-2 ${
                        (personEnrichment.careerTrajectory as Record<string, string>)?.direction === "rising" ? "bg-emerald-50 text-emerald-700"
                          : (personEnrichment.careerTrajectory as Record<string, string>)?.direction === "winding_down" ? "bg-amber-50 text-amber-700"
                            : "bg-blue-50 text-blue-700"
                      }`}>
                        <span className="material-symbols-outlined text-xs">
                          {(personEnrichment.careerTrajectory as Record<string, string>)?.direction === "rising" ? "trending_up" : (personEnrichment.careerTrajectory as Record<string, string>)?.direction === "winding_down" ? "trending_down" : "trending_flat"}
                        </span>
                        {t.ai.enrichment[(personEnrichment.careerTrajectory as Record<string, string>)?.direction === "winding_down" ? "windingDown" : ((personEnrichment.careerTrajectory as Record<string, string>)?.direction as "rising" | "stable") ?? "stable"]}
                      </span>
                      <p className="text-sm text-slate-700 leading-relaxed">{(personEnrichment.careerTrajectory as Record<string, string>)?.details}</p>
                    </div>

                    {/* Engagement Strategy */}
                    {personEnrichment.engagementStrategy && (
                      <div className="bg-white rounded-2xl p-5 border border-blue-50">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-3 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">handshake</span>
                          {t.ai.enrichment.engagementStrategy}
                        </h3>
                        <p className="text-sm text-slate-700 mb-3">{(personEnrichment.engagementStrategy as Record<string, unknown>)?.approach as string}</p>
                        {((personEnrichment.engagementStrategy as Record<string, unknown>)?.topics as string[])?.length > 0 && (
                          <div className="mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">{t.ai.enrichment.topics}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {((personEnrichment.engagementStrategy as Record<string, unknown>)?.topics as string[]).map((topic, i) => (
                                <span key={i} className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">{topic}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {!!(personEnrichment.engagementStrategy as Record<string, unknown>)?.avoid && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">{t.ai.enrichment.avoid}</p>
                            <p className="text-xs text-red-600">{(personEnrichment.engagementStrategy as Record<string, unknown>)?.avoid as string}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Key Insights */}
                    {(personEnrichment.keyInsights as string[])?.length > 0 && (
                      <div className="bg-white rounded-2xl p-5">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{t.ai.enrichment.keyInsights}</h3>
                        <ul className="space-y-1.5">
                          {(personEnrichment.keyInsights as string[]).map((insight, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                              <span className="material-symbols-outlined text-xs text-cyan-400 shrink-0 mt-0.5">check_circle</span>
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Regenerate */}
                    <div className="flex items-center justify-between px-1">
                      {personEnrichment.createdAt && (
                        <p className="text-[11px] text-slate-400">
                          {t.ai.enrichment.lastGenerated}: {new Date(personEnrichment.createdAt as string).toLocaleDateString(locale === "da" ? "da-DK" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                      <button
                        onClick={() => {
                          if (!validId || !person) return;
                          personEnrichmentMutation.mutate({
                            participantNumber: validId,
                            personName: person.life.name,
                            locale,
                            personData: person as unknown as Record<string, unknown>,
                            companies: companies as unknown as Record<string, unknown>[],
                          });
                        }}
                        disabled={personEnrichmentMutation.isPending}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                        {t.ai.enrichment.regenerate}
                      </button>
                    </div>
                  </>
                )}

                {personEnrichmentMutation.isError && (
                  <div className="bg-red-50 rounded-2xl p-4 text-center">
                    <p className="text-sm text-red-600">{t.ai.enrichment.error}</p>
                  </div>
                )}
              </div>
            )}
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
                {totalActiveRoles}
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
                  {totalHistoricalRoles}
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
      className={`block bg-white rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,74,198,0.06)] hover:-translate-y-0.5 group ${
        historical ? "opacity-60 hover:opacity-100" : ""
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* Top row: avatar + company info + arrow */}
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm`}
          >
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            {/* Name + status + role badges inline */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
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

            {/* CVR + company type */}
            <div className="flex items-center gap-1.5 mt-0.5 text-[12px] text-slate-400">
              <span className="tabular-nums font-medium">CVR {company.vat}</span>
              {company.companyform?.description && (
                <>
                  <span className="text-slate-200">·</span>
                  <span>{company.companyform.description.toUpperCase()}</span>
                </>
              )}
            </div>
          </div>

          <span className="material-symbols-outlined text-lg text-slate-200 group-hover:text-blue-500 transition-colors shrink-0 mt-2">
            arrow_forward
          </span>
        </div>

        {/* Role badges — compact row below company header */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {displayRoles.map((role, ri) => {
            const isActive = !role.life.end;
            const config = ROLE_CONFIG[role.type] || DEFAULT_ROLE;
            return (
              <span
                key={ri}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${config.bg} ${config.text}`}
              >
                <span className="material-symbols-outlined text-[12px]">{config.icon}</span>
                {roleLabels[role.type] || role.type}
                {isActive && (
                  <span className="inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5" />
                )}
              </span>
            );
          })}
        </div>

        {/* Role details — dates, ownership */}
        <div className="mt-2.5 space-y-1.5 pl-0.5">
          {displayRoles.map((role, ri) => {
            const config = ROLE_CONFIG[role.type] || DEFAULT_ROLE;
            const hasOwnership = role.life?.owner_percent != null;
            const hasDates = role.life?.start;
            if (!hasDates && !hasOwnership) return null;
            return (
              <div key={ri} className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                <span className={`font-semibold ${config.text}`}>
                  {roleLabels[role.type] || role.type}
                </span>
                {role.life?.title &&
                  role.life.title !== (roleLabels[role.type] || role.type) && (
                    <span className="text-slate-500">{role.life.title}</span>
                  )}
                {hasDates && (
                  <span className="tabular-nums">
                    {formatDate(role.life.start!, locale)}
                    <span className="mx-0.5 text-slate-200">→</span>
                    {role.life.end ? formatDate(role.life.end, locale) : (locale === "da" ? "nu" : "present")}
                    {!role.life.end && <span className="inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1.5 -translate-y-px" />}
                  </span>
                )}
                {hasOwnership && (
                  <span className="text-slate-500">
                    <span className="text-slate-200">·</span>
                    {" "}{pd.ownershipPercent}: <span className="font-semibold text-slate-700">{role.life.owner_percent}%</span>
                    {role.life.owner_voting_percent != null && (
                      <>
                        {" "}<span className="text-slate-200">·</span>
                        {" "}{pd.votingPercent}: <span className="font-semibold text-slate-700">{role.life.owner_voting_percent}%</span>
                      </>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Link>
  );
}
