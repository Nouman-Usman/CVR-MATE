"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { useSavedCompanies, useUnsaveCompany } from "@/lib/hooks/use-saved-companies";

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

export default function SavedPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const sv = t.saved;

  const { data, isLoading: loading } = useSavedCompanies();
  const unsaveMutation = useUnsaveCompany();
  const companies = (data?.results ?? []) as SavedCompany[];

  const handleRemove = (cvr: string) => {
    unsaveMutation.mutate(cvr);
  };
  const removing = unsaveMutation.isPending ? (unsaveMutation.variables ?? null) : null;

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
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
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
                            <p className="text-sm font-semibold text-slate-900 truncate hover:text-blue-600 transition-colors">
                              {c.name}
                            </p>
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
