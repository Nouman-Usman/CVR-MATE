"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { useSavedCompanies, useUnsaveCompany } from "@/lib/hooks/use-saved-companies";
import { usePipelineAnalysis, type PipelineResponse } from "@/lib/hooks/use-pipeline-analysis";

interface SavedCompany {
  id: string;
  cvr: string;
  savedAt: string;
  company: {
    id: string;
    vat: string;
    name: string;
    address: string | null;
    city: string | null;
    zipcode: string | null;
    industryName: string | null;
    companyStatus: string | null;
    employees: number | null;
  };
}

const companyColors = [
  { bg: "bg-blue-100", text: "text-blue-600" },
  { bg: "bg-amber-100", text: "text-amber-600" },
  { bg: "bg-violet-100", text: "text-violet-600" },
  { bg: "bg-cyan-100", text: "text-cyan-600" },
];

const priorityConfig = {
  high: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  medium: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
  low: { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200" },
} as const;

export default function SavedPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const sv = t.saved;
  const ai = t.ai;

  const { data, isLoading: loading } = useSavedCompanies();
  const unsaveMutation = useUnsaveCompany();
  const companies = (data?.results ?? []) as SavedCompany[];

  const handleRemove = (cvr: string) => {
    unsaveMutation.mutate(cvr);
  };
  const removing = unsaveMutation.isPending ? (unsaveMutation.variables ?? null) : null;

  // AI Pipeline Analysis
  const pipelineMutation = usePipelineAnalysis();
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [expandedSegment, setExpandedSegment] = useState<number | null>(null);

  const handleAnalyze = () => {
    const vats = companies.map(c => c.cvr).slice(0, 25);
    pipelineMutation.mutate({ companyVats: vats, locale });
    setShowAnalysis(true);
    setExpandedSegment(null);
  };

  const handleDismissAnalysis = () => {
    setShowAnalysis(false);
    pipelineMutation.reset();
    setExpandedSegment(null);
  };

  const priorityMap = new Map<string, { score: string; reason: string }>();
  const analysisData = pipelineMutation.data;
  if (analysisData?.prioritized) {
    for (const p of analysisData.prioritized) {
      priorityMap.set(p.vat, { score: p.score, reason: p.reason });
    }
  }

  const segments = analysisData?.segments ?? [];
  const nextActions = analysisData?.nextActions ?? [];
  const prioritized = analysisData?.prioritized ?? [];

  // Count priorities for the summary
  const highCount = prioritized.filter(p => p.score === "high").length;
  const mediumCount = prioritized.filter(p => p.score === "medium").length;
  const lowCount = prioritized.filter(p => p.score === "low").length;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)]">
            {sv.title}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {sv.subtitle} · {companies.length} {sv.count}
          </p>
        </div>
        {companies.length > 0 && (
          <button
            onClick={handleAnalyze}
            disabled={pipelineMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm hover:from-violet-700 hover:to-purple-700 transition-all shadow-sm cursor-pointer disabled:opacity-60 shrink-0"
          >
            {pipelineMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-lg">auto_awesome</span>
            )}
            {pipelineMutation.isPending ? ai.pipeline.analyzing : ai.pipeline.analyze}
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-16 text-center">
          <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-slate-400 font-medium">...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && companies.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-20 text-center">
          <span
            className="material-symbols-outlined text-6xl text-slate-200 mb-4 block"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            favorite
          </span>
          <p className="text-slate-400 font-medium mb-6">{sv.noCompanies}</p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">search</span>
            {sv.searchCompanies}
          </Link>
        </div>
      )}

      {/* AI Pipeline Analysis — Loading */}
      {showAnalysis && pipelineMutation.isPending && (
        <div className="bg-white rounded-2xl shadow-sm border border-violet-100/60 p-8 text-center mb-6">
          <div className="w-10 h-10 border-3 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">{ai.pipeline.analyzing}</p>
          <p className="text-xs text-slate-400 mt-1">
            {locale === "da" ? "Dette kan tage et øjeblik..." : "This may take a moment..."}
          </p>
        </div>
      )}

      {/* AI Pipeline Analysis — Error */}
      {showAnalysis && pipelineMutation.isError && (
        <div className="bg-red-50 rounded-2xl border border-red-100 p-5 mb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-red-400 text-lg mt-0.5 shrink-0">error</span>
              <div>
                <p className="text-sm font-semibold text-red-700">
                  {ai.pipeline.error}
                </p>
                <p className="text-xs text-red-500 mt-1">
                  {pipelineMutation.error?.message}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleAnalyze}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                {locale === "da" ? "Prøv igen" : "Retry"}
              </button>
              <button
                onClick={handleDismissAnalysis}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Pipeline Analysis — Results */}
      {showAnalysis && analysisData && !pipelineMutation.isPending && (
        <div className="space-y-4 mb-6">
          {/* Header with dismiss */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-violet-600">auto_awesome</span>
                {ai.pipeline.priority}
              </h3>
              <button
                onClick={handleDismissAnalysis}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
                title={locale === "da" ? "Luk" : "Close"}
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            {/* Summary counts */}
            {prioritized.length > 0 ? (
              <div className="flex items-center gap-4 flex-wrap">
                {highCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-sm text-slate-600">
                      <span className="font-bold text-emerald-600">{highCount}</span>{" "}
                      {ai.pipeline.high}
                    </span>
                  </div>
                )}
                {mediumCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-slate-600">
                      <span className="font-bold text-amber-600">{mediumCount}</span>{" "}
                      {ai.pipeline.medium}
                    </span>
                  </div>
                )}
                {lowCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex w-3 h-3 rounded-full bg-slate-400" />
                    <span className="text-sm text-slate-600">
                      <span className="font-bold text-slate-500">{lowCount}</span>{" "}
                      {ai.pipeline.low}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                {locale === "da" ? "Ingen prioriteringer fundet." : "No prioritization data returned."}
              </p>
            )}
          </div>

          {/* Segments */}
          {segments.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-violet-600">category</span>
                {ai.pipeline.segments}
              </h3>
              <div className="space-y-2">
                {segments.map((seg, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 overflow-hidden">
                    <button
                      onClick={() => setExpandedSegment(expandedSegment === i ? null : i)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-600">
                          {seg.vats?.length ?? 0}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">{seg.name}</span>
                      </div>
                      <span className="material-symbols-outlined text-slate-400 text-lg">
                        {expandedSegment === i ? "expand_less" : "expand_more"}
                      </span>
                    </button>
                    {expandedSegment === i && (
                      <div className="px-3 pb-3">
                        <p className="text-sm text-slate-600">{seg.insight}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Actions */}
          {nextActions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-emerald-500">task_alt</span>
                {ai.pipeline.nextActions}
              </h3>
              <div className="space-y-2">
                {nextActions.map((na, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                    <span className="material-symbols-outlined text-emerald-500 text-lg mt-0.5 shrink-0">arrow_right</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{na.name}</p>
                      <p className="text-sm text-slate-600">{na.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results table */}
      {!loading && companies.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 sm:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {sv.table.company}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {sv.table.cvr}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">
                    {sv.table.city}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">
                    {sv.table.industry}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">
                    {sv.table.status}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">
                    {sv.table.employees}
                  </th>
                  <th className="w-20 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {companies.map((s, idx) => {
                  const c = s.company;
                  const color = companyColors[idx % companyColors.length];
                  const initials = c.name
                    .split(" ")
                    .filter(w => w.length > 0)
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  const priority = priorityMap.get(s.cvr);
                  const pConfig = priority ? priorityConfig[priority.score as keyof typeof priorityConfig] : null;
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/company/${c.vat}`)}
                    >
                      <td className="px-4 sm:px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full ${color.bg} flex items-center justify-center shrink-0`}
                          >
                            <span
                              className={`text-xs font-bold ${color.text}`}
                            >
                              {initials}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900 truncate hover:text-blue-600 transition-colors">
                                {c.name}
                              </p>
                              {priority && pConfig && (
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 border ${pConfig.bg} ${pConfig.text} ${pConfig.border}`}
                                  title={priority.reason}
                                >
                                  {priority.score}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">
                              {c.address && `${c.address}, `}
                              {c.zipcode} {c.city}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 tabular-nums">
                        {c.vat}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 hidden md:table-cell">
                        {c.city || "–"}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 hidden lg:table-cell truncate max-w-[160px]">
                        {c.industryName || "–"}
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {c.companyStatus && (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                            {c.companyStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 tabular-nums hidden lg:table-cell">
                        {c.employees != null
                          ? c.employees.toLocaleString(
                              locale === "da" ? "da-DK" : "en-US"
                            )
                          : "–"}
                      </td>
                      <td
                        className="px-3 py-3.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRemove(s.cvr)}
                            disabled={removing === s.cvr}
                            className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
                            title={sv.removed}
                          >
                            <span className="material-symbols-outlined text-lg">
                              {removing === s.cvr
                                ? "progress_activity"
                                : "delete"}
                            </span>
                          </button>
                          <span className="material-symbols-outlined text-slate-300 text-lg">
                            open_in_new
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
