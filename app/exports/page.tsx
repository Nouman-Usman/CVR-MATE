"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { InlineLoader } from "@/components/loading-screen";
import { useSavedCompanies } from "@/lib/hooks/use-saved-companies";
import { useActiveConnections, useBulkPushToCrm } from "@/lib/hooks/use-integrations";
import { useExportCheck } from "@/lib/hooks/use-subscription";
import { companyColors } from "@/lib/constants/colors";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Search,
  X,
  FileSpreadsheet,
  FileText,
  FileDown,
  Loader2,
  Download,
  AlertCircle,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Info,
  Users,
  Building2,
  Mail,
  ChevronRight,
} from "lucide-react";

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
  return name.split(" ").filter(w => w.length > 0).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
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
        (c) => c.name.toLowerCase().includes(q) || c.cvr.includes(q) || c.city.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name": return dir * a.name.localeCompare(b.name);
        case "city": return dir * a.city.localeCompare(b.city);
        case "employees": return dir * ((a.employees ?? 0) - (b.employees ?? 0));
        case "founded": return dir * a.founded.localeCompare(b.founded);
        case "savedAt": return dir * a.savedAt.localeCompare(b.savedAt);
        default: return 0;
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

  /* ── CSV Export ────────────────────────────────────────────────────────── */
  const exportCsv = useCallback(async () => {
    const leads = getExportTargets();
    if (leads.length === 0) { showToast(ex.noData, "info"); return; }
    try { await exportCheck.mutateAsync(); } catch (err) {
      showToast(err instanceof Error ? err.message : "Export not allowed", "info"); return;
    }
    setExporting("csv");
    const headers = [ex.table.company, "CVR", ex.table.city, ex.table.industry, ex.table.type, ex.table.status, ex.table.founded, ex.table.employees, ex.table.phone, ex.table.email, "Website"].join(",");
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

  /* ── Excel Export ─────────────────────────────────────────────────────── */
  const exportExcel = useCallback(async () => {
    const leads = getExportTargets();
    if (leads.length === 0) { showToast(ex.noData, "info"); return; }
    try { await exportCheck.mutateAsync(); } catch (err) {
      showToast(err instanceof Error ? err.message : "Export not allowed", "info"); return;
    }
    setExporting("excel");
    try {
      const XLSX = await import("xlsx");
      const headerRow = [ex.table.company, "CVR", ex.table.city, ex.table.industry, ex.table.type, ex.table.status, ex.table.founded, ex.table.employees, ex.table.phone, ex.table.email, "Website"];
      const dataRows = leads.map((l) => [l.name, l.cvr, l.city, l.industry, l.companyType, l.status, l.founded, l.employees ?? "", l.phone, l.email, l.website]);
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

      // Column widths
      ws["!cols"] = [
        { wch: 30 }, { wch: 12 }, { wch: 16 }, { wch: 24 }, { wch: 14 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 28 }, { wch: 28 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      XLSX.writeFile(wb, `cvr-mate-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(ex.excelNote);
    } catch {
      showToast("Excel export failed", "info");
    } finally {
      setExporting(null);
    }
  }, [getExportTargets, showToast, ex, exportCheck]);

  /* ── PDF Export ────────────────────────────────────────────────────────── */
  const exportPdf = useCallback(async () => {
    const leads = getExportTargets();
    if (leads.length === 0) { showToast(ex.noData, "info"); return; }
    try { await exportCheck.mutateAsync(); } catch (err) {
      showToast(err instanceof Error ? err.message : "Export not allowed", "info"); return;
    }
    setExporting("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("CVR Mate — Lead Export", 14, 18);
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${new Date().toLocaleDateString(locale === "da" ? "da-DK" : "en-US", { year: "numeric", month: "long", day: "numeric" })} • ${leads.length} ${ex.companies}`,
        14, 25
      );

      autoTable(doc, {
        startY: 32,
        head: [[ex.table.company, "CVR", ex.table.city, ex.table.industry, ex.table.type, ex.table.status, ex.table.employees, ex.table.phone, ex.table.email]],
        body: leads.map((l) => [l.name, l.cvr, l.city, l.industry, l.companyType, l.status, l.employees != null ? String(l.employees) : "–", l.phone, l.email]),
        styles: { fontSize: 8, cellPadding: 3, textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.1 },
        headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139], fontStyle: "bold", fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`CVR Mate • Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
      }

      doc.save(`cvr-mate-export-${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast(ex.pdfExported);
    } catch {
      showToast("PDF export failed", "info");
    } finally {
      setExporting(null);
    }
  }, [getExportTargets, showToast, ex, locale, exportCheck]);

  /* ── Sort handler ──────────────────────────────────────────────────────── */
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="size-3 text-muted-foreground/30 ml-0.5" />;
    return sortDir === "asc"
      ? <ArrowUp className="size-3 text-primary ml-0.5" />
      : <ArrowDown className="size-3 text-primary ml-0.5" />;
  };

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <DashboardLayout>
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300",
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-foreground text-background"
        )}>
          {toast.type === "success" ? <CheckCircle2 className="size-4" /> : <Info className="size-4" />}
          {toast.msg}
        </div>
      )}

      {/* CRM Push Modal */}
      <Dialog open={showCrmModal} onOpenChange={setShowCrmModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ig.pushToCrm}</DialogTitle>
            <DialogDescription>
              {someSelected ? `${selected.size} ${ex.selected}` : `${companies.length} ${ex.companies}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {activeConnections.map((conn) => (
              <button
                key={conn.id}
                onClick={() => {
                  const targets = getExportTargets();
                  const companyIds = targets
                    .map((t) => {
                      const saved = data?.results?.find((r) => r.cvr === t.cvr);
                      return (saved?.company as Record<string, unknown>)?.id as string | undefined;
                    })
                    .filter((id): id is string => !!id);
                  if (companyIds.length === 0) { showToast(ex.noData, "info"); return; }
                  bulkPush.mutate(
                    { connectionId: conn.id, companyIds },
                    {
                      onSuccess: (res) => {
                        setShowCrmModal(false);
                        showToast(`${res.summary.success} ${ig.bulkComplete.replace("{failed}", String(res.summary.failed))}`, res.summary.failed > 0 ? "info" : "success");
                      },
                      onError: () => showToast(ig.pushError, "info"),
                    }
                  );
                }}
                disabled={bulkPush.isPending}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-muted/30 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  conn.provider === "hubspot" ? "bg-orange-50" : conn.provider === "leadconnector" ? "bg-orange-50" : "bg-green-50"
                )}>
                  <Building2 className={cn(
                    "size-5",
                    conn.provider === "hubspot" ? "text-orange-500" : conn.provider === "leadconnector" ? "text-orange-500" : "text-green-600"
                  )} />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-semibold text-foreground capitalize">{conn.provider}</p>
                  <p className="text-xs text-muted-foreground">{ig.pushAll}</p>
                </div>
                {bulkPush.isPending ? <Loader2 className="size-5 text-primary animate-spin" /> : <ChevronRight className="size-4 text-muted-foreground" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)]">
            {ex.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">{ex.subtitle}</p>
        </div>

        {allCompanies.length > 0 && (
          <div className="flex gap-2 self-start sm:self-auto flex-wrap">
            <Button variant="outline" className="rounded-xl gap-2" onClick={exportCsv} disabled={!!exporting}>
              {exporting === "csv" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              CSV
            </Button>
            <Button variant="outline" className="rounded-xl gap-2" onClick={exportExcel} disabled={!!exporting}>
              {exporting === "excel" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
              Excel
            </Button>
            <Button variant="gradient" className="rounded-xl gap-2" onClick={exportPdf} disabled={!!exporting}>
              {exporting === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
              PDF
            </Button>
            {activeConnections.length > 0 && (
              <Button className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowCrmModal(true)} disabled={!!exporting}>
                <Building2 className="size-4" />
                {ig.pushToCrm}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Stats row ─────────────────────────────────────────── */}
      {!isLoading && !isError && allCompanies.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Download className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">{allCompanies.length}</p>
                <p className="text-[11px] text-muted-foreground font-medium">{ex.companies}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                <Mail className="size-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">{allCompanies.filter(c => c.email).length}</p>
                <p className="text-[11px] text-muted-foreground font-medium">{locale === "da" ? "Med email" : "With email"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Users className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">
                  {new Set(allCompanies.map(c => c.industry).filter(Boolean)).size}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">{locale === "da" ? "Brancher" : "Industries"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">{selected.size || "–"}</p>
                <p className="text-[11px] text-muted-foreground font-medium">{ex.selected}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Search + sort bar ─────────────────────────────────── */}
      {!isLoading && !isError && allCompanies.length > 0 && (
        <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 text-muted-foreground/50 absolute left-4 top-1/2 -translate-y-1/2" />
            <Input
              className="h-11 rounded-xl pl-11 pr-9 border-border/60 bg-muted/30 focus:bg-background transition-colors"
              placeholder={ex.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <Button variant="ghost" size="icon-xs" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X className="size-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">{ex.sortBy}</span>
            <select
              value={sortKey}
              onChange={(e) => { setSortKey(e.target.value as SortKey); setSortDir("asc"); }}
              className="px-3 py-2.5 text-sm bg-background border border-input rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring cursor-pointer"
            >
              <option value="savedAt">{ex.sortSaved}</option>
              <option value="name">{ex.sortName}</option>
              <option value="city">{ex.sortCity}</option>
              <option value="employees">{ex.sortEmployees}</option>
              <option value="founded">{ex.sortFounded}</option>
            </select>
            <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
              {sortDir === "asc" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            </Button>
          </div>
          {companies.length > 0 && (
            <Badge variant="secondary" className="border-0 text-xs font-semibold h-7 px-3 shrink-0 ml-auto">
              {companies.length} {search ? `${ex.of} ${allCompanies.length}` : ""} {ex.companies}
            </Badge>
          )}
        </div>
      )}

      {/* ── Selection bar ─────────────────────────────────────── */}
      {someSelected && (
        <Card className="border-primary/20 bg-primary/5 mb-5 py-0">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                {selected.size}
              </div>
              <p className="text-sm font-semibold text-foreground">
                {selected.size} {ex.selected}
              </p>
              <button onClick={clearSelection} className="text-xs font-medium text-primary hover:underline underline-offset-2 cursor-pointer">
                {ex.clearSelection}
              </button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={exportCsv} disabled={!!exporting}>
                <FileText className="size-3.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={exportExcel} disabled={!!exporting}>
                <FileSpreadsheet className="size-3.5" /> Excel
              </Button>
              <Button size="sm" className="rounded-xl gap-1.5" onClick={exportPdf} disabled={!!exporting}>
                <FileDown className="size-3.5" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Loading ──────────────────────────────────────────── */}
      {isLoading && <InlineLoader />}

      {/* ── Error state ───────────────────────────────────────── */}
      {isError && !isLoading && (
        <Card className="py-16 border-0 shadow-sm">
          <CardContent className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-destructive/5 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="size-7 text-destructive/40" />
            </div>
            <p className="text-foreground font-semibold mb-1">{ex.errorTitle}</p>
            <Button variant="outline" onClick={() => refetch()} className="rounded-xl gap-2 mt-4">
              <RefreshCw className="size-4" />
              {ex.errorRetry}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!isLoading && !isError && allCompanies.length === 0 && (
        <Card className="py-16 border-0 shadow-sm">
          <CardContent className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Download className="size-7 text-muted-foreground/30" />
            </div>
            <p className="text-foreground font-semibold mb-1">{ex.noSaved}</p>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-5">{ex.noSavedDesc}</p>
            <Link href="/search" className={cn(buttonVariants({ variant: "outline" }), "rounded-xl gap-2")}>
              <Search className="size-4" />
              {ex.searchCompanies}
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      {!isLoading && !isError && allCompanies.length > 0 && (
        <>
          <Card className="overflow-hidden border-0 shadow-sm py-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="w-12 pl-5">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      className="size-4"
                    />
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("name")}>
                    <span className="inline-flex items-center">{ex.table.company} <SortIcon col="name" /></span>
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {ex.table.cvr}
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell cursor-pointer select-none" onClick={() => handleSort("city")}>
                    <span className="inline-flex items-center">{ex.table.city} <SortIcon col="city" /></span>
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                    {ex.table.industry}
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                    {ex.table.status}
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden lg:table-cell cursor-pointer select-none" onClick={() => handleSort("employees")}>
                    <span className="inline-flex items-center">{ex.table.employees} <SortIcon col="employees" /></span>
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden xl:table-cell">
                    {ex.table.email}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center">
                      <Search className="size-8 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm font-medium">{ex.noData}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  companies.map((c, idx) => {
                    const color = companyColors[idx % companyColors.length];
                    const isSelected = selected.has(c.cvr);
                    return (
                      <TableRow
                        key={c.cvr}
                        onClick={() => toggle(c.cvr)}
                        className={cn(
                          "cursor-pointer border-border/30",
                          isSelected ? "bg-primary/5 hover:bg-primary/10" : ""
                        )}
                      >
                        <TableCell className="pl-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggle(c.cvr)} className="size-4" />
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm", color.bg)}>
                              <span className={cn("text-xs font-bold", color.text)}>{initials(c.name)}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate max-w-[200px]">{c.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {[c.address, c.zipcode, c.city].filter(Boolean).join(", ")}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5 text-sm text-muted-foreground tabular-nums font-mono">{c.cvr}</TableCell>
                        <TableCell className="py-3.5 text-sm text-muted-foreground hidden md:table-cell">{c.city || "–"}</TableCell>
                        <TableCell className="py-3.5 text-sm text-muted-foreground hidden lg:table-cell truncate max-w-[160px]">{c.industry || "–"}</TableCell>
                        <TableCell className="py-3.5 hidden md:table-cell">
                          {c.status ? (
                            <Badge variant="secondary" className={cn(
                              "border-0 text-[9px] font-bold uppercase tracking-wider h-5",
                              c.status.toLowerCase().includes("aktiv") || c.status.toLowerCase().includes("normal")
                                ? "bg-emerald-50 text-emerald-700"
                                : c.status.toLowerCase().includes("ophørt") || c.status.toLowerCase().includes("opløst")
                                  ? "bg-red-50 text-red-600"
                                  : ""
                            )}>
                              {c.status}
                            </Badge>
                          ) : <span className="text-muted-foreground/40">–</span>}
                        </TableCell>
                        <TableCell className="py-3.5 text-sm text-muted-foreground tabular-nums hidden lg:table-cell">
                          {c.employees != null ? c.employees.toLocaleString(locale === "da" ? "da-DK" : "en-US") : "–"}
                        </TableCell>
                        <TableCell className="py-3.5 hidden xl:table-cell">
                          {c.email ? (
                            <a
                              href={`mailto:${c.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm text-primary hover:underline truncate block max-w-[180px]"
                            >
                              {c.email}
                            </a>
                          ) : <span className="text-muted-foreground/40">–</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              {someSelected
                ? `${selected.size} ${ex.selected} · ${ex.selectNote}`
                : `${ex.allLeads} · ${ex.selectNote}`}
            </p>
            {someSelected && (
              <p className="text-xs font-medium text-primary">
                {ex.exportSelected}: {selected.size} {ex.companies}
              </p>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
