"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";

interface SavedCompany {
  id: string;
  cvr: string;
  name: string;
  address: string;
  city: string;
  zipcode: string;
  industry: string;
  status: string;
  employees: number | null;
}

const mockSaved: SavedCompany[] = [
  { id: "1", cvr: "41234567", name: "TechVentures ApS", address: "Østerbrogade 12", city: "København", zipcode: "2100", industry: "IT-programmering", status: "AKTIV", employees: 23 },
  { id: "2", cvr: "41345678", name: "Nordic Retail Group A/S", address: "Søndergade 45", city: "Aarhus", zipcode: "8000", industry: "Detailhandel", status: "AKTIV", employees: 145 },
  { id: "3", cvr: "41567890", name: "Byg & Anlæg Danmark ApS", address: "Hobrovej 88", city: "Aalborg", zipcode: "9000", industry: "Byggeri", status: "AKTIV", employees: 67 },
  { id: "4", cvr: "42234567", name: "MediCare Danmark A/S", address: "Amager Strandvej 3", city: "København", zipcode: "2300", industry: "Sundhedsvæsen", status: "AKTIV", employees: 210 },
  { id: "5", cvr: "41789012", name: "DataInsight Nordic ApS", address: "Nørrebrogade 120", city: "København", zipcode: "2200", industry: "IT-programmering", status: "AKTIV", employees: 35 },
];

const companyColors = [
  { bg: "bg-blue-100", text: "text-blue-600" },
  { bg: "bg-amber-100", text: "text-amber-600" },
  { bg: "bg-violet-100", text: "text-violet-600" },
  { bg: "bg-cyan-100", text: "text-cyan-600" },
];

export default function SavedPage() {
  const { t, locale } = useLanguage();
  const sv = t.saved;

  const [companies, setCompanies] = useState<SavedCompany[]>(mockSaved);

  const handleRemove = (id: string) => {
    setCompanies((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)]">
          {sv.title}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {sv.subtitle} · {companies.length} {sv.count}
        </p>
      </div>

      {companies.length === 0 ? (
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
      ) : (
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
                {companies.map((c, idx) => {
                  const color = companyColors[idx % companyColors.length];
                  const initials = c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <tr
                      key={c.id}
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
                      <td
                        className="px-3 py-3.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRemove(c.id)}
                            className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
                            title={sv.removed}
                          >
                            <span className="material-symbols-outlined text-lg">
                              delete
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
