"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { useSavedCompanies } from "@/lib/hooks/use-saved-companies";
import { useActiveConnections, useBulkPushToCrm } from "@/lib/hooks/use-integrations";
import { useExportCheck } from "@/lib/hooks/use-subscription";

/* ── Types ──────────────────────────────────────────────────────────────── */

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
  savedAt: string;
}

type SortKey = "name" | "city" | "employees" | "founded" | "savedAt";
type SortDir = "asc" | "desc";

/* ── Helpers ────────────────────────────────────────────────────────────── */

const companyColors = [
  { bg: "bg-blue-100", text: "text-blue-600" },
  { bg: "bg-amber-100", text: "text-amber-600" },
  { bg: "bg-violet-100", text: "text-violet-600" },
  { bg: "bg-cyan-100", text: "text-cyan-600" },
  { bg: "bg-rose-100", text: "text-rose-600" },
  { bg: "bg-emerald-100", text: "text-emerald-600" },
];

function mapSavedToExport(s: { cvr: string; savedAt: string; company: Record<string, unknown> }): ExportCompany {
  const c = s.company as Record<string, string | number | null | undefined>;
  return {
    cvr: s.cvr,
    name: (c.name as string) ?? "",
    address: (c.address as string) ?? "",
    city: (c.city as string) ?? "",
    zipcode: (c.zipcode as string) ?? "",
    industry: (c.industryName as string) ?? (c.industry_name as string) ?? "",
    companyType: (c.companyType as string) ?? (c.company_type as string) ?? "",
    status: (c.companyStatus as string) ?? (c.company_status as string) ?? "",
    founded: (c.founded as string) ?? "",
    employees: (c.employees as number) ?? null,
    phone: (c.phone as string) ?? "",
    email: (c.email as string) ?? "",
    website: (c.website as string) ?? "",
    savedAt: s.savedAt,
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* ── Component ──────────────────────────────────────────────────────────── */

export default function ExportsPage() {
  const { t, locale } = useLanguage();
  const ex = t.exports;

  const { data, isLoading, isError, refetch } = useSavedCompanies();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; type: "success" | "info" } | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("savedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [exporting, setExporting] = useState<string | null>(null);
  const [showCrmModal, setShowCrmModal] = useState(false);

  /* CRM integration */
  const activeConnections = useActiveConnections();
  const bulkPush = useBulkPushToCrm();
  const exportCheck = useExportCheck();
  const ig = t.integrations;

  /* Map API data */
  const allCompanies = useMemo(() => {
    if (!data?.results) return [];
    return data.results.map(mapSavedToExport);
  }, [data]);

  /* Filter + sort */
  const companies = useMemo(() => {
    let filtered = allCompanies;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.cvr.includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.industry.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "city":
          return dir * a.city.localeCompare(b.city);
        case "employees":
          return dir * ((a.employees ?? 0) - (b.employees ?? 0));
        case "founded":
          return dir * a.founded.localeCompare(b.founded);
        case "savedAt":
          return dir * a.savedAt.localeCompare(b.savedAt);
        default:
          return 0;
      }
    });
  }, [allCompanies, search, sortKey, sortDir]);

  const allSelected = selected.size === companies.length && companies.length > 0;
  const someSelected = selected.size > 0;

  /* Selection handlers */
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

  const clearSelection = () => setSelected(new Set());

  /* Toast */
  const showToast = useCallback((msg: string, type: "success" | "info" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* Get export targets */
  const getExportTargets = useCallback(() => {
    if (someSelected) return companies.filter((c) => selected.has(c.cvr));
    return companies;
  }, [companies, selected, someSelected]);

  /* ── CSV Export ───────────────────────────────────────────────────────── */
  const exportCsv = useCallback(async () => {
    const leads = getExportTargets();
    if (leads.length === 0) { showToast(ex.noData, "info"); return; }

    try {
      await exportCheck.mutateAsync();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Export not allowed", "info");
      return;
    }

    setExporting("csv");
    const headers = [
      ex.table.company, "CVR", ex.table.city, ex.table.industry,
      ex.table.type, ex.table.status, ex.table.founded, ex.table.employees,
      ex.table.phone, ex.table.email, "Website",
    ].join(",");

    const rows = leads.map((l) =>
      [l.name, l.cvr, l.city, l.industry, l.companyType, l.status, l.founded, l.employees ?? "", l.phone, l.email, l.website]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );

    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cvr-mate-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${leads.length} ${ex.exported}`);
    setExporting(null);
  }, [getExportTargets, showToast, ex, exportCheck]);

  /* ── Excel Export ────────────────────────────────────────────────────── */
  const exportExcel = useCallback(() => {
    showToast(ex.excelNote, "info");
  }, [showToast, ex.excelNote]);

  /* ── PDF Export ──────────────────────────────────────────────────────── */
  const exportPdf = useCallback(async () => {
    const leads = getExportTargets();
    if (leads.length === 0) { showToast(ex.noData, "info"); return; }

    try {
      await exportCheck.mutateAsync();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Export not allowed", "info");
      return;
    }

    setExporting("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      // Header
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("CVR Mate — Lead Export", 14, 18);

      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `${new Date().toLocaleDateString(locale === "da" ? "da-DK" : "en-US", { year: "numeric", month: "long", day: "numeric" })} • ${leads.length} ${ex.companies}`,
        14, 25
      );

      // Table
      autoTable(doc, {
        startY: 32,
        head: [[
          ex.table.company, "CVR", ex.table.city, ex.table.industry,
          ex.table.type, ex.table.status, ex.table.employees, ex.table.phone, ex.table.email,
        ]],
        body: leads.map((l) => [
          l.name, l.cvr, l.city, l.industry, l.companyType,
          l.status, l.employees != null ? String(l.employees) : "–",
          l.phone, l.email,
        ]),
        styles: {
          fontSize: 8,
          cellPadding: 3,
          textColor: [51, 65, 85],     // slate-700
          lineColor: [226, 232, 240],  // slate-200
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [248, 250, 252],  // slate-50
          textColor: [100, 116, 139],  // slate-500
          fontStyle: "bold",
          fontSize: 7,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: 14, right: 14 },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `CVR Mate • Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: "center" }
        );
      }

      doc.save(`cvr-mate-export-${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast(ex.pdfExported);
    } catch {
      showToast("PDF export failed", "info");
    } finally {
      setExporting(null);
    }
  }, [getExportTargets, showToast, ex, locale, exportCheck]);

  /* ── Sort handler ────────────────────────────────────────────────────── */
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="material-symbols-outlined text-[14px] text-slate-300 ml-0.5">unfold_more</span>;
    return (
      <span className="material-symbols-outlined text-[14px] text-blue-500 ml-0.5">
        {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
      </span>
    );
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <DashboardLayout>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-2.5 animate-[fadeIn_0.2s] ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-slate-900 text-white"
          }`}
        >
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
            {toast.type === "success" ? "check_circle" : "info"}
          </span>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)]">
            {ex.title}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{ex.subtitle}</p>
        </div>

        {/* Export buttons */}
        {allCompanies.length > 0 && (
          <div className="flex gap-2 self-start sm:self-auto">
            <button
              onClick={exportCsv}
              disabled={!!exporting}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 bg-white rounded-full text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exporting === "csv" ? (
                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-lg">description</span>
              )}
              CSV
            </button>
            <button
              onClick={exportExcel}
              disabled={!!exporting}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 bg-white rounded-full text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg">table_view</span>
              Excel
            </button>
            <button
              onClick={exportPdf}
              disabled={!!exporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {exporting === "pdf" ? (
                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
              )}
              PDF
            </button>
            {activeConnections.length > 0 && (
              <button
                onClick={() => setShowCrmModal(true)}
                disabled={!!exporting}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-full text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-lg">sync</span>
                {ig.pushToCrm}
              </button>
            )}
          </div>
        )}
      </div>

      {/* CRM Push Modal */}
      {showCrmModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowCrmModal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">{ig.pushToCrm}</h3>
              <button
                onClick={() => setShowCrmModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-5">
              {someSelected
                ? `${selected.size} ${ex.selected}`
                : `${companies.length} ${ex.companies}`}
            </p>

            <div className="space-y-3">
              {activeConnections.map((conn) => (
                <button
                  key={conn.id}
                  onClick={() => {
                    const targets = getExportTargets();
                    // We need company DB IDs. The saved companies API returns them in the company object.
                    const companyIds = targets
                      .map((t) => {
                        const saved = data?.results?.find((r) => r.cvr === t.cvr);
                        return (saved?.company as Record<string, unknown>)?.id as string | undefined;
                      })
                      .filter((id): id is string => !!id);

                    if (companyIds.length === 0) {
                      showToast(ex.noData, "info");
                      return;
                    }

                    bulkPush.mutate(
                      { connectionId: conn.id, companyIds },
                      {
                        onSuccess: (res) => {
                          setShowCrmModal(false);
                          showToast(
                            `${res.summary.success} ${ig.bulkComplete.replace("{failed}", String(res.summary.failed))}`,
                            res.summary.failed > 0 ? "info" : "success"
                          );
                        },
                        onError: () => {
                          showToast(ig.pushError, "info");
                        },
                      }
                    );
                  }}
                  disabled={bulkPush.isPending}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    conn.provider === "hubspot" ? "bg-orange-50" : conn.provider === "salesforce" ? "bg-blue-50" : "bg-green-50"
                  }`}>
                    <span className={`material-symbols-outlined text-xl ${
                      conn.provider === "hubspot" ? "text-orange-500" : conn.provider === "salesforce" ? "text-blue-500" : "text-green-600"
                    }`}>
                      {conn.provider === "hubspot" ? "hub" : conn.provider === "salesforce" ? "cloud" : "filter_alt"}
                    </span>
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-slate-900 capitalize">{conn.provider}</p>
                    <p className="text-xs text-slate-400">{ig.pushAll}</p>
                  </div>
                  {bulkPush.isPending ? (
                    <span className="material-symbols-outlined text-blue-500 animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-24 text-center">
          <span className="material-symbols-outlined text-5xl text-blue-400 animate-spin block mb-4">
            progress_activity
          </span>
          <p className="text-slate-400 font-medium">{ex.loading}</p>
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-red-300 block mb-4">error</span>
          <p className="text-slate-600 font-semibold mb-2">{ex.errorTitle}</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-50 border border-red-200 rounded-full text-sm font-medium text-red-700 hover:bg-red-100 transition-colors mt-2"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            {ex.errorRetry}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && allCompanies.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-5">
            <span
              className="material-symbols-outlined text-4xl text-slate-300"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              download
            </span>
          </div>
          <p className="text-slate-700 font-semibold text-lg mb-1">{ex.noSaved}</p>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">{ex.noSavedDesc}</p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">search</span>
            {ex.searchCompanies}
          </Link>
        </div>
      )}

      {/* Main content */}
      {!isLoading && !isError && allCompanies.length > 0 && (
        <>
          {/* Toolbar: search + sort + count */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                search
              </span>
              <input
                type="text"
                placeholder={ex.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
            </div>

            {/* Sort dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
                {ex.sortBy}
              </span>
              <select
                value={sortKey}
                onChange={(e) => { setSortKey(e.target.value as SortKey); setSortDir("asc"); }}
                className="px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 cursor-pointer"
              >
                <option value="savedAt">{ex.sortSaved}</option>
                <option value="name">{ex.sortName}</option>
                <option value="city">{ex.sortCity}</option>
                <option value="employees">{ex.sortEmployees}</option>
                <option value="founded">{ex.sortFounded}</option>
              </select>
              <button
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors"
                title={sortDir === "asc" ? "Ascending" : "Descending"}
              >
                <span className="material-symbols-outlined text-lg text-slate-500">
                  {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                </span>
              </button>
            </div>

            {/* Count badge */}
            <div className="flex items-center gap-1.5 ml-auto text-sm text-slate-400">
              <span className="font-semibold text-slate-600">
                {companies.length}
              </span>
              {search && (
                <>
                  {ex.of} {allCompanies.length}
                </>
              )}
              {" "}{ex.companies}
            </div>
          </div>

          {/* Selection bar */}
          {someSelected && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between animate-[fadeIn_0.15s]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {selected.size}
                </div>
                <p className="text-sm font-semibold text-blue-800">
                  {selected.size} {ex.selected}
                </p>
                <button
                  onClick={clearSelection}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
                >
                  {ex.clearSelection}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportCsv}
                  disabled={!!exporting}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-blue-700 border border-blue-200 text-sm font-semibold rounded-full hover:bg-blue-50 transition-colors disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-base">description</span>
                  CSV
                </button>
                <button
                  onClick={exportPdf}
                  disabled={!!exporting}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-full hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                  PDF
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 sm:px-6 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                      />
                    </th>
                    <th
                      className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 cursor-pointer select-none hover:text-slate-600 transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      <span className="inline-flex items-center">
                        {ex.table.company}
                        <SortIcon col="name" />
                      </span>
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {ex.table.cvr}
                    </th>
                    <th
                      className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell cursor-pointer select-none hover:text-slate-600 transition-colors"
                      onClick={() => handleSort("city")}
                    >
                      <span className="inline-flex items-center">
                        {ex.table.city}
                        <SortIcon col="city" />
                      </span>
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">
                      {ex.table.industry}
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden xl:table-cell">
                      {ex.table.type}
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">
                      {ex.table.status}
                    </th>
                    <th
                      className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell cursor-pointer select-none hover:text-slate-600 transition-colors"
                      onClick={() => handleSort("employees")}
                    >
                      <span className="inline-flex items-center">
                        {ex.table.employees}
                        <SortIcon col="employees" />
                      </span>
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden xl:table-cell">
                      {ex.table.email}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {companies.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center">
                        <span className="material-symbols-outlined text-4xl text-slate-200 block mb-2">
                          search_off
                        </span>
                        <p className="text-slate-400 text-sm font-medium">
                          {ex.noData}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    companies.map((c, idx) => {
                      const color = companyColors[idx % companyColors.length];
                      const isSelected = selected.has(c.cvr);
                      return (
                        <tr
                          key={c.cvr}
                          onClick={() => toggle(c.cvr)}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-blue-50/60 hover:bg-blue-50"
                              : "hover:bg-slate-50/50"
                          }`}
                        >
                          <td
                            className="px-4 sm:px-6 py-3.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggle(c.cvr)}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-full ${color.bg} flex items-center justify-center shrink-0`}
                              >
                                <span className={`text-xs font-bold ${color.text}`}>
                                  {initials(c.name)}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate max-w-[200px]">
                                  {c.name}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {[c.address, c.zipcode, c.city].filter(Boolean).join(", ")}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-500 tabular-nums font-mono">
                            {c.cvr}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-500 hidden md:table-cell">
                            {c.city || "–"}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-500 hidden lg:table-cell truncate max-w-[160px]">
                            {c.industry || "–"}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-500 hidden xl:table-cell">
                            {c.companyType || "–"}
                          </td>
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            {c.status ? (
                              <span
                                className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  c.status.toLowerCase().includes("aktiv") ||
                                  c.status.toLowerCase().includes("normal")
                                    ? "bg-emerald-50 text-emerald-700"
                                    : c.status.toLowerCase().includes("ophørt") ||
                                      c.status.toLowerCase().includes("opløst")
                                    ? "bg-red-50 text-red-600"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {c.status}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400">–</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-500 tabular-nums hidden lg:table-cell">
                            {c.employees != null
                              ? c.employees.toLocaleString(locale === "da" ? "da-DK" : "en-US")
                              : "–"}
                          </td>
                          <td className="px-4 py-3.5 hidden xl:table-cell">
                            {c.email ? (
                              <a
                                href={`mailto:${c.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate block max-w-[180px]"
                              >
                                {c.email}
                              </a>
                            ) : (
                              <span className="text-sm text-slate-400">–</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer info */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-slate-400">
              {someSelected
                ? `${selected.size} ${ex.selected} • ${ex.selectNote}`
                : `${ex.allLeads} • ${ex.selectNote}`}
            </p>
            {someSelected && (
              <p className="text-xs font-medium text-blue-600">
                {ex.exportSelected}: {selected.size} {ex.companies}
              </p>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
