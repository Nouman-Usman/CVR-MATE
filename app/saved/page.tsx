"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { useSavedCompanies, useUnsaveCompany, useUpdateSavedNote } from "@/lib/hooks/use-saved-companies";
import { usePipelineAnalysis, type PipelineResponse } from "@/lib/hooks/use-pipeline-analysis";
import { companyColors } from "@/lib/constants/colors";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Search,
  X,
  Heart,
  Trash2,
  StickyNote,
  Plus,
  ArrowRight,
  Factory,
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Target,
  BarChart3,
  Zap,
  Building2,
} from "lucide-react";

interface SavedCompany {
  id: string;
  cvr: string;
  note: string | null;
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

const priorityConfig = {
  high: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200/60", dot: "bg-emerald-500" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200/60", dot: "bg-amber-500" },
  low: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border/60", dot: "bg-muted-foreground/50" },
} as const;

export default function SavedPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const sv = t.saved;
  const ai = t.ai;

  const { data, isLoading: loading } = useSavedCompanies();
  const unsaveMutation = useUnsaveCompany();
  const updateNoteMutation = useUpdateSavedNote();
  const companies = (data?.results ?? []) as SavedCompany[];

  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter.trim()) return companies;
    const q = filter.toLowerCase();
    return companies.filter(
      (s) =>
        s.company.name.toLowerCase().includes(q) ||
        s.cvr.includes(q) ||
        (s.company.city ?? "").toLowerCase().includes(q) ||
        (s.company.industryName ?? "").toLowerCase().includes(q)
    );
  }, [filter, companies]);

  const handleRemove = (cvr: string) => {
    unsaveMutation.mutate(cvr);
  };
  const removing = unsaveMutation.isPending ? (unsaveMutation.variables ?? null) : null;

  // Note editing state
  const [editingNoteCvr, setEditingNoteCvr] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteToast, setNoteToast] = useState("");

  const openNoteEditor = (cvr: string, currentNote: string | null) => {
    setEditingNoteCvr(cvr);
    setNoteText(currentNote ?? "");
  };

  const handleSaveNote = () => {
    if (!editingNoteCvr) return;
    updateNoteMutation.mutate(
      { cvr: editingNoteCvr, note: noteText },
      {
        onSuccess: () => {
          setEditingNoteCvr(null);
          setNoteToast(sv.noteSaved);
          setTimeout(() => setNoteToast(""), 3000);
        },
      }
    );
  };

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

  const highCount = prioritized.filter(p => p.score === "high").length;
  const mediumCount = prioritized.filter(p => p.score === "medium").length;
  const lowCount = prioritized.filter(p => p.score === "low").length;

  const handleFilterChange = (val: string) => {
    setFilter(val);
  };

  const notesCount = companies.filter(c => c.note).length;
  const activeCount = companies.filter(c => c.company.companyStatus).length;

  return (
    <DashboardLayout>
      {/* Note toast */}
      {noteToast && (
        <div className="fixed top-6 right-6 z-50 bg-foreground text-background px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle className="size-4 text-emerald-400" />
          {noteToast}
        </div>
      )}

      {/* Note edit dialog */}
      <Dialog
        open={editingNoteCvr !== null}
        onOpenChange={(open) => { if (!open) setEditingNoteCvr(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{sv.editNote}</DialogTitle>
            <DialogDescription>
              {companies.find((c) => c.cvr === editingNoteCvr)?.company.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={sv.notePlaceholder}
              maxLength={500}
              rows={3}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground text-right tabular-nums">
              {noteText.length}/500
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="rounded-xl" />}>
              {sv.cancelNote}
            </DialogClose>
            <Button
              className="rounded-xl"
              onClick={handleSaveNote}
              disabled={updateNoteMutation.isPending}
            >
              {updateNoteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {sv.saveNote}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)]">
            {sv.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {sv.subtitle} · {companies.length} {sv.count}
          </p>
        </div>
        {companies.length > 0 && (
          <Button
            variant="gradient"
            className="self-start rounded-xl shadow-sm gap-2"
            onClick={handleAnalyze}
            disabled={pipelineMutation.isPending}
          >
            {pipelineMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {pipelineMutation.isPending ? ai.pipeline.analyzing : ai.pipeline.analyze}
          </Button>
        )}
      </div>

      {/* ── Stats row ─────────────────────────────────────────── */}
      {!loading && companies.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Heart className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">
                  {companies.length}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {sv.count}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Building2 className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">
                  {activeCount}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {locale === "da" ? "Aktive" : "Active"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                <Factory className="size-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">
                  {new Set(companies.map(c => c.company.industryName).filter(Boolean)).size}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {locale === "da" ? "Brancher" : "Industries"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <StickyNote className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">
                  {notesCount}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {locale === "da" ? "Med noter" : "With notes"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Search + count bar ────────────────────────────────── */}
      {!loading && companies.length > 0 && (
        <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 text-muted-foreground/50 absolute left-4 top-1/2 -translate-y-1/2" />
            <Input
              className="h-11 rounded-xl pl-11 pr-9 border-border/60 bg-muted/30 focus:bg-background transition-colors"
              placeholder={locale === "da" ? "Filtrer efter navn, CVR, by eller branche..." : "Filter by name, CVR, city or industry..."}
              value={filter}
              onChange={(e) => handleFilterChange(e.target.value)}
            />
            {filter && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleFilterChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
          {filtered.length > 0 && (
            <Badge variant="secondary" className="border-0 text-xs font-semibold h-7 px-3 shrink-0">
              {filtered.length} {sv.count}
            </Badge>
          )}
        </div>
      )}

      {/* ── Loading skeleton ──────────────────────────────────── */}
      {loading && (
        <Card className="border-0 shadow-sm py-0">
          <CardContent className="p-0">
            <div className="p-5 space-y-0 divide-y divide-border/30">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <Skeleton className="w-11 h-11 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full hidden sm:block" />
                  <Skeleton className="h-3 w-20 hidden md:block" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!loading && companies.length === 0 && (
        <Card className="py-16 border-0 shadow-sm">
          <CardContent className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Heart className="size-7 text-muted-foreground/30" />
            </div>
            <p className="text-foreground font-semibold mb-1">
              {sv.noCompanies}
            </p>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-5">
              {locale === "da" ? "Søg efter virksomheder og gem dem her." : "Search for companies and save them here."}
            </p>
            <Link
              href="/search"
              className={cn(buttonVariants({ variant: "outline" }), "rounded-xl gap-2")}
            >
              <Search className="size-4" />
              {sv.searchCompanies}
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── AI Pipeline Analysis — Loading ─────────────────────── */}
      {showAnalysis && pipelineMutation.isPending && (
        <Card className="border-0 shadow-sm border-violet-100/60 mb-6">
          <CardContent className="py-10 text-center">
            <Loader2 className="size-8 text-violet-500 animate-spin mx-auto mb-4" />
            <p className="text-foreground font-medium">{ai.pipeline.analyzing}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "da" ? "Dette kan tage et øjeblik..." : "This may take a moment..."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── AI Pipeline Analysis — Error ───────────────────────── */}
      {showAnalysis && pipelineMutation.isError && (
        <Card className="border-0 shadow-sm bg-destructive/5 mb-6">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="size-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{ai.pipeline.error}</p>
                  <p className="text-xs text-muted-foreground mt-1">{pipelineMutation.error?.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" className="rounded-xl gap-1.5" onClick={handleAnalyze}>
                  <RefreshCw className="size-3.5" />
                  {locale === "da" ? "Prøv igen" : "Retry"}
                </Button>
                <Button variant="ghost" size="icon-sm" className="rounded-xl" onClick={handleDismissAnalysis}>
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── AI Pipeline Analysis — Results ─────────────────────── */}
      {showAnalysis && analysisData && !pipelineMutation.isPending && (
        <div className="space-y-3 mb-6">
          {/* Priority summary */}
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Target className="size-4 text-violet-500" />
                  {ai.pipeline.priority}
                </h3>
                <Button variant="ghost" size="icon-sm" className="rounded-xl" onClick={handleDismissAnalysis}>
                  <X className="size-4" />
                </Button>
              </div>
              {prioritized.length > 0 ? (
                <div className="flex items-center gap-4 flex-wrap">
                  {highCount > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-sm text-muted-foreground">
                        <span className="font-bold text-emerald-600">{highCount}</span> {ai.pipeline.high}
                      </span>
                    </div>
                  )}
                  {mediumCount > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-sm text-muted-foreground">
                        <span className="font-bold text-amber-600">{mediumCount}</span> {ai.pipeline.medium}
                      </span>
                    </div>
                  )}
                  {lowCount > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
                      <span className="text-sm text-muted-foreground">
                        <span className="font-semibold">{lowCount}</span> {ai.pipeline.low}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {locale === "da" ? "Ingen prioriteringer fundet." : "No prioritization data returned."}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Segments */}
          {segments.length > 0 && (
            <Card className="border-0 shadow-sm py-0">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="size-4 text-violet-500" />
                  {ai.pipeline.segments}
                </h3>
                <div className="space-y-2">
                  {segments.map((seg, i) => (
                    <div key={i} className="rounded-xl border border-border/40 overflow-hidden">
                      <button
                        onClick={() => setExpandedSegment(expandedSegment === i ? null : i)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="border-0 text-[10px] font-bold h-5 px-2 bg-violet-50 text-violet-600">
                            {seg.vats?.length ?? 0}
                          </Badge>
                          <span className="text-sm font-semibold text-foreground">{seg.name}</span>
                        </div>
                        {expandedSegment === i ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </button>
                      {expandedSegment === i && (
                        <div className="px-3 pb-3">
                          <p className="text-sm text-muted-foreground">{seg.insight}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next Actions */}
          {nextActions.length > 0 && (
            <Card className="border-0 shadow-sm py-0">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Zap className="size-4 text-emerald-500" />
                  {ai.pipeline.nextActions}
                </h3>
                <div className="space-y-2">
                  {nextActions.map((na, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100/60">
                      <ArrowRight className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{na.name}</p>
                        <p className="text-sm text-muted-foreground">{na.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── No filter match ────────────────────────────────────── */}
      {!loading && companies.length > 0 && filtered.length === 0 && filter && (
        <Card className="py-16 border-0 shadow-sm">
          <CardContent className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="size-7 text-muted-foreground/30" />
            </div>
            <p className="text-foreground font-semibold mb-1">
              {locale === "da" ? "Ingen match" : "No matches"}
            </p>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {locale === "da" ? "Ingen gemte virksomheder matcher dit filter." : "No saved companies match your filter."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Company table ─────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <Card className="overflow-hidden border-0 shadow-sm py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="pl-5 sm:pl-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {sv.table.company}
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {sv.table.cvr}
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                  {sv.table.city}
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                  {sv.table.industry}
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                  {sv.table.status}
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                  {sv.table.employees}
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                  {sv.note}
                </TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s, idx) => {
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
                  <TableRow
                    key={s.id}
                    className="group cursor-pointer border-border/30"
                    onClick={() => router.push(`/company/${c.vat}`)}
                  >
                    <TableCell className="pl-5 sm:pl-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm",
                          color.bg
                        )}>
                          <span className={cn("text-xs font-bold", color.text)}>{initials}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {c.name}
                            </p>
                            {priority && pConfig && (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "hidden sm:inline-flex border text-[9px] font-bold uppercase tracking-wider h-5 shrink-0",
                                  pConfig.bg, pConfig.text, pConfig.border
                                )}
                                title={priority.reason}
                              >
                                <span className={cn("w-1.5 h-1.5 rounded-full mr-1", pConfig.dot)} />
                                {priority.score}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {c.address && `${c.address}, `}{c.zipcode} {c.city}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 text-sm text-muted-foreground tabular-nums">
                      {c.vat}
                    </TableCell>
                    <TableCell className="py-3.5 text-sm text-muted-foreground hidden md:table-cell">
                      {c.city || "–"}
                    </TableCell>
                    <TableCell className="py-3.5 text-sm text-muted-foreground hidden lg:table-cell max-w-[160px] truncate">
                      {c.industryName || "–"}
                    </TableCell>
                    <TableCell className="py-3.5 hidden md:table-cell">
                      {c.companyStatus && (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0 text-[9px] font-bold uppercase tracking-wider h-5">
                          {c.companyStatus}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5 text-sm text-muted-foreground tabular-nums hidden lg:table-cell">
                      {c.employees != null
                        ? c.employees.toLocaleString(locale === "da" ? "da-DK" : "en-US")
                        : "–"}
                    </TableCell>
                    <TableCell
                      className="py-3.5 hidden md:table-cell max-w-[200px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {s.note ? (
                        <button
                          onClick={() => openNoteEditor(s.cvr, s.note)}
                          className="text-left group/note"
                        >
                          <p className="text-xs text-muted-foreground line-clamp-2 group-hover/note:text-primary transition-colors cursor-pointer">
                            {s.note}
                          </p>
                        </button>
                      ) : (
                        <button
                          onClick={() => openNoteEditor(s.cvr, null)}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/40 hover:text-primary transition-colors cursor-pointer"
                        >
                          <Plus className="size-3" />
                          {sv.addNote}
                        </button>
                      )}
                    </TableCell>
                    <TableCell
                      className="py-3.5 pr-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full text-muted-foreground/30 hover:text-amber-500 hover:bg-amber-50 md:hidden"
                          onClick={() => openNoteEditor(s.cvr, s.note)}
                          title={s.note ? sv.editNote : sv.addNote}
                        >
                          <StickyNote className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full text-muted-foreground/30 hover:text-destructive hover:bg-destructive/5"
                          onClick={() => handleRemove(s.cvr)}
                          disabled={removing === s.cvr}
                          title={sv.removed}
                        >
                          {removing === s.cvr ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </DashboardLayout>
  );
}
