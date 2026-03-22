"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";

interface ExportCompany {
  cvr: string;
  name: string;
  address: string;
  city: string;
  zipcode: string;
  industry: string;
  companyType: string;
  status: string;
  founded: string;
  employees: number | null;
  phone: string;
  email: string;
  website: string;
}

const mockCompanies: ExportCompany[] = [
  { cvr: "41234567", name: "TechVentures ApS", address: "Østerbrogade 12", city: "København", zipcode: "2100", industry: "IT-programmering", companyType: "ApS", status: "AKTIV", founded: "2025-11-01", employees: 23, phone: "+45 33 12 34 56", email: "info@techventures.dk", website: "techventures.dk" },
  { cvr: "41345678", name: "Nordic Retail Group A/S", address: "Søndergade 45", city: "Aarhus", zipcode: "8000", industry: "Detailhandel", companyType: "A/S", status: "AKTIV", founded: "2024-06-15", employees: 145, phone: "+45 86 12 34 56", email: "kontakt@nordicretail.dk", website: "nordicretail.dk" },
  { cvr: "41567890", name: "Byg & Anlæg Danmark ApS", address: "Hobrovej 88", city: "Aalborg", zipcode: "9000", industry: "Byggeri", companyType: "ApS", status: "AKTIV", founded: "2023-09-10", employees: 67, phone: "+45 98 12 34 56", email: "post@bygdanmark.dk", website: "bygdanmark.dk" },
  { cvr: "42234567", name: "MediCare Danmark A/S", address: "Amager Strandvej 3", city: "København", zipcode: "2300", industry: "Sundhedsvæsen", companyType: "A/S", status: "AKTIV", founded: "2023-11-18", employees: 210, phone: "+45 32 12 34 56", email: "info@medicare.dk", website: "medicare.dk" },
  { cvr: "41789012", name: "DataInsight Nordic ApS", address: "Nørrebrogade 120", city: "København", zipcode: "2200", industry: "IT-programmering", companyType: "ApS", status: "AKTIV", founded: "2025-08-22", employees: 35, phone: "+45 35 12 34 56", email: "hello@datainsight.dk", website: "datainsight.dk" },
];

const companyColors = [
  { bg: "bg-blue-100", text: "text-blue-600" },
  { bg: "bg-amber-100", text: "text-amber-600" },
  { bg: "bg-violet-100", text: "text-violet-600" },
  { bg: "bg-cyan-100", text: "text-cyan-600" },
];

export default function ExportsPage() {
  const { t, locale } = useLanguage();
  const ex = t.exports;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const companies = mockCompanies;
  const allSelected = selected.size === companies.length && companies.length > 0;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(companies.map((c) => c.cvr)));
  };

  const toggle = (cvr: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cvr)) next.delete(cvr);
      else next.add(cvr);
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const exportCsv = () => {
    const leads = selected.size > 0
      ? companies.filter((c) => selected.has(c.cvr))
      : companies;
    if (leads.length === 0) { showToast(ex.noData); return; }

    const headers = [ex.table.company, "CVR", ex.table.city, ex.table.industry, ex.table.type, ex.table.status, "Founded", ex.table.employees, "Phone", "Email", "Website"].join(",");
    const rows = leads.map((l) =>
      `"${l.name}","${l.cvr}","${l.city}","${l.industry}","${l.companyType}","${l.status}","${l.founded}","${l.employees ?? ""}","${l.phone}","${l.email}","${l.website}"`
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cvr-mate-export.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${leads.length} ${ex.exported}`);
  };

  const exportExcel = () => {
    showToast(ex.excelNote);
  };

  return (
    <DashboardLayout>
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl text-sm font-medium flex items-center gap-2 animate-[fadeIn_0.2s]">
          <span className="material-symbols-outlined text-lg">info</span>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)]">
            {ex.title}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{ex.subtitle}</p>
        </div>
        <div className="flex gap-2 self-start">
          <button
            onClick={exportCsv}
            disabled={companies.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 bg-white rounded-full text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-lg">description</span>
            CSV
          </button>
          <button
            onClick={exportExcel}
            disabled={companies.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 bg-white rounded-full text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-lg">table_view</span>
            Excel
          </button>
        </div>
      </div>

      {companies.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-20 text-center">
          <span
            className="material-symbols-outlined text-6xl text-slate-200 mb-4 block"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            favorite
          </span>
          <p className="text-slate-400 font-medium mb-6">{ex.noSaved}</p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">search</span>
            {ex.searchCompanies}
          </Link>
        </div>
      ) : (
        <>
          {/* Selection bar */}
          {selected.size > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-blue-700">
                {selected.size} {ex.selected}
              </p>
              <button
                onClick={exportCsv}
                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-full hover:bg-blue-700 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">download</span>
                CSV
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 sm:px-6 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                      />
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {ex.table.company}
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {ex.table.cvr}
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">
                      {ex.table.city}
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">
                      {ex.table.industry}
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">
                      {ex.table.type}
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">
                      {ex.table.status}
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">
                      {ex.table.employees}
                    </th>
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
                        <td
                          className="px-4 sm:px-6 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(c.cvr)}
                            onChange={() => toggle(c.cvr)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full ${color.bg} flex items-center justify-center shrink-0`}>
                              <span className={`text-xs font-bold ${color.text}`}>{initials}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {c.name}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {c.address}, {c.zipcode} {c.city}
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
                        <td className="px-4 py-3.5 text-sm text-slate-500 hidden lg:table-cell truncate max-w-[160px]">
                          {c.industry}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-500 hidden lg:table-cell">
                          {c.companyType}
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-500 tabular-nums hidden lg:table-cell">
                          {c.employees != null
                            ? c.employees.toLocaleString(
                                locale === "da" ? "da-DK" : "en-US"
                              )
                            : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-4">
            {selected.size > 0
              ? `${selected.size} ${ex.selected}`
              : ex.allLeads}{" "}
            • {ex.selectNote}
          </p>
        </>
      )}
    </DashboardLayout>
  );
}
