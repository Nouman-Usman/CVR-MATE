"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";

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

// Mock data — replace with real API calls later
const allMockCompanies: Company[] = [
  { cvr: "44123456", name: "Nordic Health ApS", city: "København", industry: "Sundhed", status: "AKTIV", founded: "2026-03-22", employees: "12" },
  { cvr: "44234567", name: "GreenBuild Danmark A/S", city: "Aarhus", industry: "Byggeri", status: "AKTIV", founded: "2026-03-22", employees: "85" },
  { cvr: "44345678", name: "DataFlow Solutions ApS", city: "Odense", industry: "IT & Software", status: "AKTIV", founded: "2026-03-21", employees: "34" },
  { cvr: "44456789", name: "Scandi Logistics ApS", city: "Aalborg", industry: "Transport", status: "AKTIV", founded: "2026-03-21", employees: "200+" },
  { cvr: "44567890", name: "CleanTech Nordic IVS", city: "Esbjerg", industry: "Energi", status: "AKTIV", founded: "2026-03-20", employees: "18" },
  { cvr: "44678901", name: "FoodTech Danmark ApS", city: "Roskilde", industry: "Fødevarer", status: "AKTIV", founded: "2026-03-20", employees: "7" },
  { cvr: "44789012", name: "Nordic Fintech Group A/S", city: "København", industry: "Finans", status: "AKTIV", founded: "2026-03-19", employees: "45" },
  { cvr: "44890123", name: "SmartHome DK ApS", city: "Vejle", industry: "IoT & Elektronik", status: "AKTIV", founded: "2026-03-19", employees: "22" },
  { cvr: "44901234", name: "BioMed Scandinavia ApS", city: "København", industry: "Biotek", status: "AKTIV", founded: "2026-03-18", employees: "15" },
  { cvr: "45012345", name: "EduPlatform ApS", city: "Aarhus", industry: "EdTech", status: "AKTIV", founded: "2026-03-18", employees: "9" },
  { cvr: "45123456", name: "Nordic Solar Energy A/S", city: "Silkeborg", industry: "Energi", status: "AKTIV", founded: "2026-03-17", employees: "62" },
  { cvr: "45234567", name: "Maritime AI Solutions", city: "København", industry: "Maritime", status: "AKTIV", founded: "2026-03-17", employees: "28" },
  { cvr: "45345678", name: "AgriTech DK IVS", city: "Herning", industry: "Landbrug", status: "AKTIV", founded: "2026-03-16", employees: "5" },
  { cvr: "45456789", name: "DesignStudio Nord ApS", city: "Aarhus", industry: "Design", status: "AKTIV", founded: "2026-03-16", employees: "11" },
  { cvr: "45567890", name: "CyberShield Danmark A/S", city: "København", industry: "Cybersikkerhed", status: "AKTIV", founded: "2026-03-15", employees: "37" },
  { cvr: "45678901", name: "PropTech Nordic ApS", city: "Odense", industry: "Ejendom", status: "AKTIV", founded: "2026-03-15", employees: "14" },
  { cvr: "45789012", name: "HealthData ApS", city: "København", industry: "HealthTech", status: "AKTIV", founded: "2026-03-14", employees: "19" },
  { cvr: "45890123", name: "RetailNext DK ApS", city: "Aalborg", industry: "Retail", status: "AKTIV", founded: "2026-03-14", employees: "8" },
  { cvr: "45901234", name: "GreenMobility Solutions", city: "København", industry: "Transport", status: "AKTIV", founded: "2026-03-13", employees: "31" },
  { cvr: "46012345", name: "CloudOps Nordic A/S", city: "Aarhus", industry: "Cloud & Infra", status: "AKTIV", founded: "2026-03-13", employees: "53" },
  { cvr: "46123456", name: "Nordic HR Tech ApS", city: "Vejle", industry: "HRTech", status: "AKTIV", founded: "2026-03-12", employees: "16" },
  { cvr: "46234567", name: "WasteZero DK IVS", city: "Randers", industry: "Miljø", status: "AKTIV", founded: "2026-03-12", employees: "6" },
  { cvr: "46345678", name: "TravelTech Scandi ApS", city: "København", industry: "Rejser", status: "AKTIV", founded: "2026-03-11", employees: "24" },
  { cvr: "46456789", name: "MedDevice Nordic A/S", city: "Hillerød", industry: "MedTech", status: "AKTIV", founded: "2026-03-11", employees: "42" },
  { cvr: "46567890", name: "InsurTech Danmark ApS", city: "København", industry: "Forsikring", status: "AKTIV", founded: "2026-03-10", employees: "13" },
];

const companyColors = [
  { bg: "bg-blue-100", text: "text-blue-600" },
  { bg: "bg-amber-100", text: "text-amber-600" },
  { bg: "bg-violet-100", text: "text-violet-600" },
  { bg: "bg-cyan-100", text: "text-cyan-600" },
];

export default function RecentCompaniesPage() {
  const { t, locale } = useLanguage();
  const r = t.recent;

  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!filter.trim()) return allMockCompanies;
    const q = filter.toLowerCase();
    return allMockCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.cvr.includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q)
    );
  }, [filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const companies = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  const toggleSave = (cvr: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(cvr)) next.delete(cvr);
      else next.add(cvr);
      return next;
    });
  };

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
        <button className="self-start flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
          <span className="material-symbols-outlined text-lg">refresh</span>
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

      {/* Table */}
      {companies.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-200 mb-3 block">
            apartment
          </span>
          <p className="text-slate-400 font-medium">
            {filter ? r.noFilter : r.noCompanies}
          </p>
        </div>
      ) : (
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
                    return (
                      <tr
                        key={c.cvr}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 sm:px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full ${color.bg} flex items-center justify-center shrink-0`}>
                              <span className={`text-xs font-bold ${color.text}`}>{initials}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
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
                          {c.city}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-500 hidden lg:table-cell truncate max-w-[180px]">
                          {c.industry}
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-400 tabular-nums hidden lg:table-cell">
                          {new Date(c.founded).toLocaleDateString(
                            locale === "da" ? "da-DK" : "en-US"
                          )}
                        </td>
                        <td
                          className="px-3 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => toggleSave(c.cvr)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <span
                              className={`material-symbols-outlined text-lg ${
                                saved.has(c.cvr)
                                  ? "text-red-500"
                                  : "text-slate-300"
                              }`}
                              style={
                                saved.has(c.cvr)
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
