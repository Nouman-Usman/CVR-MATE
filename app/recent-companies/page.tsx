"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { useRecentCompanies } from "@/lib/hooks/use-recent-companies";
import { useSavedCvrSet, useSaveCompany, useUnsaveCompany } from "@/lib/hooks/use-saved-companies";

const PAGE_SIZE = 20;

interface Company {
  cvr: string;
  name: string;
  city: string;
  industry: string;
  status: string;
  founded: string;
  employees: string;
}

function mapCvrCompany(c: Record<string, unknown>): Company {
  const comp = c as {
    vat?: number;
    life?: { name?: string; start?: string };
    address?: { cityname?: string };
    industry?: { primary?: { text?: string } };
    companystatus?: { text?: string };
    employment?: { months?: { amount?: number | null }[] };
  };

  const latestEmployment = comp.employment?.months?.[0]?.amount;

  return {
    cvr: String(comp.vat ?? ""),
    name: comp.life?.name ?? "",
    city: comp.address?.cityname ?? "",
    industry: comp.industry?.primary?.text ?? "",
    status: comp.companystatus?.text ?? "",
    founded: comp.life?.start ?? "",
    employees: latestEmployment != null ? String(latestEmployment) : "–",
  };
}

const companyColors = [
  { bg: "bg-blue-100", text: "text-blue-600" },
  { bg: "bg-amber-100", text: "text-amber-600" },
  { bg: "bg-violet-100", text: "text-violet-600" },
  { bg: "bg-cyan-100", text: "text-cyan-600" },
];

export default function RecentCompaniesPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const r = t.recent;

  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  // Fetch recent companies (last 7 days, cached 24h server-side via Redis)
  const { data, isLoading, error: fetchError, forceRefresh, isFetching } = useRecentCompanies(7);
  const rawResults = data?.results ?? [];

  // Map and filter
  const allCompanies = useMemo(() => rawResults.map(r => mapCvrCompany(r as unknown as Record<string, unknown>)), [rawResults]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return allCompanies;
    const q = filter.toLowerCase();
    return allCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.cvr.includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q)
    );
  }, [filter, allCompanies]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const companies = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  // Saved companies integration
  const savedCvrs = useSavedCvrSet();
  const saveCompanyMutation = useSaveCompany();
  const unsaveCompanyMutation = useUnsaveCompany();

  const handleSaveToggle = (c: Company, rawResult: Record<string, unknown>) => {
    if (savedCvrs.has(c.cvr)) {
      unsaveCompanyMutation.mutate(c.cvr);
    } else {
      saveCompanyMutation.mutate({ vat: c.cvr, name: c.name, rawData: rawResult });
    }
  };
  const savingCvr = saveCompanyMutation.isPending
    ? (saveCompanyMutation.variables?.vat ?? null)
    : unsaveCompanyMutation.isPending
      ? (unsaveCompanyMutation.variables ?? null)
      : null;

  const handleFilterChange = (val: string) => {
    setFilter(val);
    setPage(1);
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)]">
            {r.title}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {r.subtitle} · {filtered.length} {r.found}
          </p>
        </div>
        <button
          onClick={() => forceRefresh()}
          disabled={isFetching}
          className="self-start flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-lg ${isFetching ? "animate-spin" : ""}`}>
            refresh
          </span>
          {r.refresh}
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4 relative max-w-md">
        <span className="material-symbols-outlined text-slate-400 text-lg absolute left-3 top-1/2 -translate-y-1/2">
          search
        </span>
        <input
          className="w-full bg-white border border-slate-200 rounded-full py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          placeholder={r.filterPlaceholder}
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value)}
        />
        {filter && (
          <button
            onClick={() => handleFilterChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-16 text-center">
          <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-slate-400 font-medium">...</p>
        </div>
      )}

      {/* Error */}
      {!isLoading && fetchError && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-200 mb-3 block">error</span>
          <p className="text-slate-400 font-medium">{r.fetchError}</p>
        </div>
      )}

      {/* Empty / No filter match */}
      {!isLoading && !fetchError && companies.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-200 mb-3 block">
            apartment
          </span>
          <p className="text-slate-400 font-medium">
            {filter ? r.noFilter : r.noCompanies}
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !fetchError && companies.length > 0 && (
        <>
          <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 sm:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {r.table.company}
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {r.table.cvr}
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">
                      {r.table.city}
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">
                      {r.table.industry}
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">
                      {r.table.status}
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">
                      {r.table.founded}
                    </th>
                    <th className="w-12 px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {companies.map((c, idx) => {
                    const color = companyColors[idx % companyColors.length];
                    const initials = c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                    const isSaved = savedCvrs.has(c.cvr);
                    const rawResult = rawResults.find(
                      r => (r as unknown as { vat: number }).vat === Number(c.cvr)
                    ) as unknown as Record<string, unknown> | undefined;
                    return (
                      <tr
                        key={c.cvr}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/company/${c.cvr}`)}
                      >
                        <td className="px-4 sm:px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full ${color.bg} flex items-center justify-center shrink-0`}>
                              <span className={`text-xs font-bold ${color.text}`}>{initials}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate hover:text-blue-600 transition-colors">
                                {c.name}
                              </p>
                              <p className="text-[10px] text-slate-400 md:hidden">
                                {c.city} · {c.cvr}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-500 tabular-nums">
                          {c.cvr}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-500 hidden md:table-cell">
                          {c.city || "–"}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-500 hidden lg:table-cell truncate max-w-[180px]">
                          {c.industry || "–"}
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                            {c.status || r.statusActive}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-400 tabular-nums hidden lg:table-cell">
                          {c.founded
                            ? new Date(c.founded).toLocaleDateString(
                                locale === "da" ? "da-DK" : "en-US"
                              )
                            : "–"}
                        </td>
                        <td
                          className="px-3 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => rawResult && handleSaveToggle(c, rawResult)}
                            disabled={savingCvr === c.cvr}
                            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <span
                              className={`material-symbols-outlined text-lg ${
                                isSaved
                                  ? "text-red-500"
                                  : "text-slate-300"
                              }`}
                              style={
                                isSaved
                                  ? { fontVariationSettings: "'FILL' 1" }
                                  : undefined
                              }
                            >
                              favorite
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-3">
            <p className="text-sm text-slate-400">
              {r.showing} {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filtered.length)} {r.of}{" "}
              {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-2 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-lg">
                  chevron_left
                </span>
              </button>
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                    p === page
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-2 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-lg">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
