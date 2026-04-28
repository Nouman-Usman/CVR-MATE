"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import { VideoTrigger } from "@/components/videos/VideoTrigger";
import DashboardLayout from "@/components/dashboard-layout";
import { InlineLoader } from "@/components/loading-screen";
import { useSavedCompanies, useUnsaveCompany, useUpdateSavedNote, useUpdateSavedTags } from "@/lib/hooks/use-saved-companies";
import { useCreateTodo } from "@/lib/hooks/use-todos";
import { usePipelineAnalysis, type PipelineResponse } from "@/lib/hooks/use-pipeline-analysis";
import { useActiveConnections, usePushToCrm, useBulkPushToCrm } from "@/lib/hooks/use-integrations";
import { useSubscription } from "@/lib/hooks/use-subscription";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuGroup,
  ContextMenuLabel,
} from "@/components/ui/context-menu";
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
  Tag,
  ExternalLink,
  MoreHorizontal,
  Eye,
  Copy,
  ListTodo,
  Upload,
  CheckSquare,
  Square,
  ArrowUpFromLine,
} from "lucide-react";

interface SavedCompany {
  id: string;
  cvr: string;
  note: string | null;
  tags: string[];
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
  const updateTagsMutation = useUpdateSavedTags();
  const companies = (data?.results ?? []) as SavedCompany[];

  const [filter, setFilter] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Collect all unique tags for the tag filter bar
  const allTags = useMemo(() => {
    const tagSet = new Map<string, number>();
    for (const c of companies) {
      for (const tag of c.tags ?? []) {
        tagSet.set(tag, (tagSet.get(tag) ?? 0) + 1);
      }
    }
    return [...tagSet.entries()].sort((a, b) => b[1] - a[1]);
  }, [companies]);

  const filtered = useMemo(() => {
    let list = companies;
    // Tag filter
    if (activeTag) {
      list = list.filter((s) => (s.tags ?? []).includes(activeTag));
    }
    // Text filter
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (s) =>
          s.company.name.toLowerCase().includes(q) ||
          s.cvr.includes(q) ||
          (s.company.city ?? "").toLowerCase().includes(q) ||
          (s.company.industryName ?? "").toLowerCase().includes(q) ||
          (s.tags ?? []).some(tag => tag.toLowerCase().includes(q))
      );
    }
    return list;
  }, [filter, activeTag, companies]);

  const handleRemove = (cvr: string) => {
    unsaveMutation.mutate(cvr);
  };
  const removing = unsaveMutation.isPending ? (unsaveMutation.variables ?? null) : null;

  // Note editing state
  const [editingNoteCvr, setEditingNoteCvr] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const openNoteEditor = (cvr: string, currentNote: string | null) => {
    setEditingNoteCvr(cvr);
    setNoteText(currentNote ?? "");
  };

  // Unified toast
  const [toast, setToast] = useState("");
  const showToast = (msg: string, durationMs = 3000) => {
    setToast(msg);
    // Show errors longer so the user can read them
    const duration = msg.toLowerCase().includes("fail") || msg.toLowerCase().includes("error") || msg.toLowerCase().includes("fejl")
      ? Math.max(durationMs, 6000)
      : durationMs;
    setTimeout(() => setToast(""), duration);
  };

  const handleSaveNote = () => {
    if (!editingNoteCvr) return;
    updateNoteMutation.mutate(
      { cvr: editingNoteCvr, note: noteText },
      {
        onSuccess: () => {
          setEditingNoteCvr(null);
          showToast(sv.noteSaved);
        },
      }
    );
  };

  // Tag editing state
  const [editingTagsCvr, setEditingTagsCvr] = useState<string | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const openTagEditor = (cvr: string, currentTags: string[]) => {
    setEditingTagsCvr(cvr);
    setEditTags([...currentTags]);
    setTagInput("");
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().slice(0, 30);
    if (!tag || editTags.length >= 10 || editTags.includes(tag)) return;
    setEditTags([...editTags, tag]);
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter(t => t !== tag));
  };

  const handleSaveTags = () => {
    if (!editingTagsCvr) return;
    updateTagsMutation.mutate(
      { cvr: editingTagsCvr, tags: editTags },
      {
        onSuccess: () => {
          setEditingTagsCvr(null);
          showToast(sv.tagsSaved);
        },
      }
    );
  };

  // Task creation
  const createTodoMutation = useCreateTodo();
  const [taskForCompany, setTaskForCompany] = useState<{ cvr: string; name: string } | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState<"high" | "medium" | "low">("medium");
  const [taskDueDate, setTaskDueDate] = useState("");

  const openTaskCreator = (cvr: string, name: string) => {
    setTaskForCompany({ cvr, name });
    setTaskTitle("");
    setTaskDesc("");
    setTaskPriority("medium");
    setTaskDueDate("");
  };

  const handleCreateTask = () => {
    if (!taskForCompany || !taskTitle.trim()) return;
    createTodoMutation.mutate(
      {
        title: taskTitle.trim(),
        description: taskDesc.trim() || null,
        priority: taskPriority,
        dueDate: taskDueDate || null,
        cvr: taskForCompany.cvr,
      },
      {
        onSuccess: () => {
          setTaskForCompany(null);
          showToast(sv.taskCreated);
        },
      }
    );
  };

  // CRM Push
  const activeConnections = useActiveConnections();
  const pushToCrm = usePushToCrm();
  const bulkPush = useBulkPushToCrm();
  const { data: subData } = useSubscription();
  const canUseCrm = (subData?.limits?.crmConnections ?? 0) > 0;
  const hasCrmConnections = activeConnections.length > 0;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCrmDialog, setShowCrmDialog] = useState(false);
  const [crmPushTarget, setCrmPushTarget] = useState<"selected" | "all">("selected");

  const toggleSelect = (companyId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(s => s.company.id)));
    }
  };

  const handleSinglePush = (connectionId: string, companyId: string, providerName: string) => {
    pushToCrm.mutate(
      { connectionId, companyId },
      {
        onSuccess: (res) => {
          const action = res.action === "push_company" ? (locale === "da" ? "Sendt til" : "Pushed to") : (locale === "da" ? "Opdateret i" : "Updated in");
          showToast(`${action} ${providerName}`);
        },
        onError: (err) => showToast(`${locale === "da" ? "Fejl" : "Error"}: ${err.message}`),
      }
    );
  };

  const handleBulkPush = (connectionId: string, providerName: string) => {
    const ids = crmPushTarget === "all"
      ? filtered.map(s => s.company.id)
      : [...selected];
    if (ids.length === 0) return;

    bulkPush.mutate(
      { connectionId, companyIds: ids },
      {
        onSuccess: (res) => {
          // Extract first error message for user visibility
          const firstError = res.results?.find((r: { status: string; error?: string }) => r.status === "error")?.error;
          const errorHint = firstError
            ? ` — ${firstError.length > 80 ? firstError.slice(0, 80) + "…" : firstError}`
            : "";
          showToast(
            `${res.summary.success} ${locale === "da" ? "sendt til" : "pushed to"} ${providerName}${
              res.summary.failed > 0
                ? `, ${res.summary.failed} ${locale === "da" ? "fejlede" : "failed"}${errorHint}`
                : ""
            }`
          );
          setShowCrmDialog(false);
          setSelected(new Set());
        },
        onError: (err) => showToast(`${locale === "da" ? "Fejl" : "Error"}: ${err.message}`),
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

  const notesCount = companies.filter(c => c.note).length;
  const activeCount = companies.filter(c => c.company.companyStatus).length;
  const taggedCount = companies.filter(c => (c.tags ?? []).length > 0).length;

  return (
    <VideoTrigger featureKey="saved">
      <DashboardLayout>
        {/* Unified toast */}
        {toast && (
        <div className="fixed top-6 right-6 z-50 bg-foreground text-background px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle className="size-4 text-emerald-400" />
          {toast}
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

      {/* Tag edit dialog — Stitch-inspired design */}
      <Dialog
        open={editingTagsCvr !== null}
        onOpenChange={(open) => { if (!open) setEditingTagsCvr(null); }}
      >
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-7 pb-3">
            <DialogHeader className="gap-0.5">
              <DialogTitle className="font-[family-name:var(--font-manrope)] text-xl font-extrabold tracking-tight">
                {sv.editTags}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-muted-foreground/70">
                {companies.find((c) => c.cvr === editingTagsCvr)?.company.name}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-6">
            {/* Active tags */}
            <div>
              <label className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground/50 mb-3 block">
                {sv.tags}
              </label>
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100/60 flex flex-wrap gap-2 min-h-[56px] items-start">
                {editTags.length === 0 && (
                  <span className="text-sm text-muted-foreground/40 italic">{sv.noTags}</span>
                )}
                {editTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 py-1.5 pl-3 pr-2 bg-blue-600 text-white rounded-full text-sm font-medium shadow-sm transition-transform active:scale-95"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:bg-white/20 rounded-full p-0.5 flex items-center justify-center cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* New tag input */}
            <div>
              <label className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground/50 mb-3 block">
                {sv.addTag}
              </label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                  placeholder={sv.tagPlaceholder}
                  maxLength={30}
                  className="flex-1 h-12 rounded-xl bg-slate-50/80 border-slate-100/60 focus:ring-2 focus:ring-blue-600/20 placeholder:text-muted-foreground/30"
                  disabled={editTags.length >= 10}
                  autoFocus
                />
                <button
                  onClick={handleAddTag}
                  disabled={!tagInput.trim() || editTags.length >= 10}
                  className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
                >
                  <Plus className="size-5" />
                </button>
              </div>
            </div>

            {/* Suggestions from existing tags */}
            {(() => {
              const suggestions = allTags
                .map(([tag]) => tag)
                .filter((tag) => !editTags.includes(tag) && (!tagInput.trim() || tag.toLowerCase().includes(tagInput.toLowerCase())));
              if (suggestions.length === 0 || editTags.length >= 10) return null;
              return (
                <div>
                  <label className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground/50 mb-3 block">
                    {locale === "da" ? "Foreslåede tags" : "Suggested tags"}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          if (editTags.length < 10 && !editTags.includes(tag)) {
                            setEditTags([...editTags, tag]);
                            setTagInput("");
                          }
                        }}
                        className="px-4 py-2 rounded-full border border-slate-200/60 text-slate-600 text-sm font-medium hover:bg-slate-100 hover:border-blue-200/60 hover:text-blue-700 transition-all cursor-pointer"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Footer — progress bar + actions */}
          <div className="px-6 pt-4 pb-6 border-t border-slate-100/40">
            {/* Progress indicator */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[12px] font-bold text-muted-foreground/50 tabular-nums whitespace-nowrap">
                <span className="text-blue-600">{editTags.length}</span>/10 {locale === "da" ? "TAGS BRUGT" : "TAGS USED"}
              </span>
              <div className="h-[3px] flex-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${(editTags.length / 10) * 100}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DialogClose
                render={
                  <button className="h-12 font-semibold text-muted-foreground/60 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer" />
                }
              >
                {sv.cancelNote}
              </DialogClose>
              <button
                onClick={handleSaveTags}
                disabled={updateTagsMutation.isPending}
                className="h-12 font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl shadow-xl shadow-blue-600/10 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {updateTagsMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {sv.saveNote}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task creation dialog */}
      <Dialog
        open={taskForCompany !== null}
        onOpenChange={(open) => { if (!open) setTaskForCompany(null); }}
      >
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <div className="px-6 pt-7 pb-3">
            <DialogHeader className="gap-0.5">
              <DialogTitle className="font-[family-name:var(--font-manrope)] text-xl font-extrabold tracking-tight">
                {sv.createTask}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-muted-foreground/70">
                {taskForCompany?.name}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-4 space-y-4">
            {/* Title */}
            <div>
              <label className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground/50 mb-2 block">
                {sv.taskTitle}
              </label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && taskTitle.trim()) handleCreateTask(); }}
                placeholder={locale === "da" ? "Hvad skal gøres?" : "What needs to be done?"}
                className="h-12 rounded-xl bg-slate-50/80 border-slate-100/60"
                autoFocus
              />
            </div>
            {/* Description */}
            <div>
              <label className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground/50 mb-2 block">
                {sv.taskDesc}
              </label>
              <Textarea
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder={locale === "da" ? "Tilføj flere detaljer..." : "Add more details..."}
                rows={2}
                className="rounded-xl bg-slate-50/80 border-slate-100/60 resize-none"
              />
            </div>
            {/* Priority */}
            <div>
              <label className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground/50 mb-2 block">
                {sv.taskPriority}
              </label>
              <div className="flex bg-slate-50 rounded-full p-1 gap-1">
                {(["high", "medium", "low"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setTaskPriority(p)}
                    className={cn(
                      "flex-1 py-2 rounded-full text-xs font-bold transition-all cursor-pointer capitalize",
                      taskPriority === p
                        ? p === "high" ? "bg-red-500 text-white shadow-sm"
                          : p === "medium" ? "bg-amber-500 text-white shadow-sm"
                            : "bg-emerald-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p === "high" ? (locale === "da" ? "Høj" : "High")
                      : p === "medium" ? (locale === "da" ? "Medium" : "Medium")
                        : (locale === "da" ? "Lav" : "Low")}
                  </button>
                ))}
              </div>
            </div>
            {/* Due date */}
            <div>
              <label className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground/50 mb-2 block">
                {sv.taskDue}
              </label>
              <Input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="h-12 rounded-xl bg-slate-50/80 border-slate-100/60"
              />
            </div>
          </div>
          <div className="px-6 pt-4 pb-6 border-t border-slate-100/40">
            <div className="grid grid-cols-2 gap-3">
              <DialogClose
                render={
                  <button className="h-12 font-semibold text-muted-foreground/60 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer" />
                }
              >
                {sv.cancelNote}
              </DialogClose>
              <button
                onClick={handleCreateTask}
                disabled={!taskTitle.trim() || createTodoMutation.isPending}
                className="h-12 font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl shadow-xl shadow-blue-600/10 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {createTodoMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {sv.createTask}
              </button>
            </div>
          </div>
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
                <Tag className="size-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">
                  {taggedCount}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {locale === "da" ? "Taggede" : "Tagged"}
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

      {/* ── Search + Tag filter bar ──────────────────────────── */}
      {!loading && companies.length > 0 && (
        <div className="mb-5 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="size-4 text-muted-foreground/50 absolute left-4 top-1/2 -translate-y-1/2" />
              <Input
                className="h-11 rounded-xl pl-11 pr-9 border-border/60 bg-muted/30 focus:bg-background transition-colors"
                placeholder={locale === "da" ? "Filtrer efter navn, CVR, by, branche eller tag..." : "Filter by name, CVR, city, industry or tag..."}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              {filter && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setFilter("")}
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
            {hasCrmConnections && filtered.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50 shrink-0"
                onClick={() => { if (!bulkPush.isPending) { setCrmPushTarget("all"); setShowCrmDialog(true); } }}
                disabled={bulkPush.isPending}
              >
                {bulkPush.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ArrowUpFromLine className="size-3.5" />
                )}
                {bulkPush.isPending
                  ? (locale === "da" ? "Sender..." : "Pushing...")
                  : (locale === "da" ? "Send alle til CRM" : "Push all to CRM")}
              </Button>
            )}
          </div>

          {/* Tag filter chips */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="size-3.5 text-muted-foreground/50 shrink-0" />
              <button
                onClick={() => setActiveTag(null)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer",
                  !activeTag
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {locale === "da" ? "Alle" : "All"}
              </button>
              {allTags.map(([tag, count]) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer",
                    activeTag === tag
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  )}
                >
                  {tag}
                  <span className="ml-1 opacity-60">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Loading skeleton ──────────────────────────────────── */}
      {loading && <InlineLoader />}

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
      {!loading && companies.length > 0 && filtered.length === 0 && (filter || activeTag) && (
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
            {activeTag && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 rounded-xl gap-1.5"
                onClick={() => setActiveTag(null)}
              >
                <X className="size-3.5" />
                {locale === "da" ? "Ryd tag-filter" : "Clear tag filter"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Company list — card-based, mobile-first ──────────── */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
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
              <ContextMenu key={s.id}>
              <ContextMenuTrigger render={
              <div
                className="group bg-white rounded-2xl transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,74,198,0.06)] hover:-translate-y-0.5 cursor-pointer"
                onClick={() => router.push(`/company/${c.vat}`)}
              />
              }>
                <div className="p-4 sm:p-5">
                  {/* ─ Top row: avatar + info + actions ─ */}
                  <div className="flex items-start gap-3.5">
                    {/* Checkbox for bulk selection */}
                    {hasCrmConnections && (
                      <div
                        className="shrink-0 flex items-center pt-1.5"
                        onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer",
                          selected.has(c.id)
                            ? "bg-indigo-600 border-indigo-600"
                            : "border-slate-200 hover:border-slate-400"
                        )}>
                          {selected.has(c.id) && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="text-white">
                              <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Avatar */}
                    <div className={cn(
                      "w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                      color.bg
                    )}>
                      <span className={cn("text-xs sm:text-sm font-bold", color.text)}>{initials}</span>
                    </div>

                    {/* Info block */}
                    <div className="min-w-0 flex-1">
                      {/* Name row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[15px] font-semibold text-foreground group-hover:text-blue-600 transition-colors truncate">
                          {c.name}
                        </h3>
                        {c.companyStatus && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                            {c.companyStatus}
                          </span>
                        )}
                        {priority && pConfig && (
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                            pConfig.bg, pConfig.text, pConfig.border
                          )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", pConfig.dot)} />
                            {priority.score}
                          </span>
                        )}
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-1.5 mt-1 text-[12px] text-muted-foreground">
                        <span className="tabular-nums font-medium">{c.vat}</span>
                        {c.city && (
                          <>
                            <span className="text-muted-foreground/30">·</span>
                            <span>{c.city}</span>
                          </>
                        )}
                        {c.employees != null && (
                          <>
                            <span className="text-muted-foreground/30">·</span>
                            <span>{c.employees.toLocaleString(locale === "da" ? "da-DK" : "en-US")} {locale === "da" ? "ansatte" : "emp."}</span>
                          </>
                        )}
                      </div>

                      {/* Industry */}
                      {c.industryName && (
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{c.industryName}</p>
                      )}
                    </div>

                    {/* Dropdown menu — always visible */}
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-slate-100 transition-colors cursor-pointer" />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="bottom" align="end" sideOffset={4} className="w-52">
                          <div className="px-2 py-1.5">
                            <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50 truncate">
                              {c.name}
                            </p>
                          </div>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => router.push(`/company/${c.vat}`)}
                          >
                            <Eye className="size-4 text-muted-foreground" />
                            {locale === "da" ? "Vis virksomhed" : "View company"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => { navigator.clipboard.writeText(c.vat); showToast(locale === "da" ? "CVR kopieret" : "CVR copied"); }}
                          >
                            <Copy className="size-4 text-muted-foreground" />
                            {locale === "da" ? "Kopiér CVR" : "Copy CVR"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => openNoteEditor(s.cvr, s.note)}
                          >
                            <StickyNote className="size-4 text-amber-500" />
                            {s.note ? sv.editNote : sv.addNote}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => openTagEditor(s.cvr, s.tags ?? [])}
                          >
                            <Tag className="size-4 text-blue-500" />
                            {sv.editTags}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => openTaskCreator(s.cvr, c.name)}
                          >
                            <ListTodo className="size-4 text-emerald-500" />
                            {sv.createTask}
                          </DropdownMenuItem>
                          {hasCrmConnections && (
                            <>
                              <DropdownMenuSeparator />
                              {activeConnections.map((conn) => (
                                <DropdownMenuItem
                                  key={conn.id}
                                  className="gap-2 cursor-pointer"
                                  onClick={() => handleSinglePush(conn.id, c.id, conn.provider)}
                                  disabled={pushToCrm.isPending}
                                >
                                  {pushToCrm.isPending ? (
                                    <Loader2 className="size-4 text-indigo-400 animate-spin" />
                                  ) : (
                                    <Upload className="size-4 text-indigo-500" />
                                  )}
                                  {pushToCrm.isPending
                                    ? (locale === "da" ? "Sender..." : "Pushing...")
                                    : (locale === "da" ? `Send til ${conn.provider}` : `Push to ${conn.provider}`)}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            className="gap-2 cursor-pointer"
                            onClick={() => handleRemove(s.cvr)}
                            disabled={removing === s.cvr}
                          >
                            {removing === s.cvr ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                            {locale === "da" ? "Fjern fra gemte" : "Remove from saved"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* ─ Bottom section: tags + note ─ */}
                  {((s.tags ?? []).length > 0 || s.note) && (
                    <div className="mt-3 pt-3 border-t border-slate-50 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                      {/* Tags */}
                      {(s.tags ?? []).length > 0 && (
                        <div
                          className="flex flex-wrap gap-1.5 items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Tag className="size-3 text-muted-foreground/30 shrink-0" />
                          {(s.tags ?? []).map(tag => (
                            <button
                              key={tag}
                              onClick={() => openTagEditor(s.cvr, s.tags ?? [])}
                              className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Note preview */}
                      {s.note && (
                        <div
                          className="flex items-start gap-1.5 sm:ml-auto max-w-xs"
                          onClick={(e) => { e.stopPropagation(); openNoteEditor(s.cvr, s.note); }}
                        >
                          <StickyNote className="size-3 text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-muted-foreground/60 line-clamp-1 hover:text-foreground transition-colors cursor-pointer">
                            {s.note}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ContextMenuTrigger>

              <ContextMenuContent className="w-56">
                <ContextMenuGroup>
                  <ContextMenuLabel>
                    {c.name.length > 30 ? c.name.slice(0, 30) + "..." : c.name}
                  </ContextMenuLabel>
                  <p className="px-1.5 pb-1 text-[11px] text-muted-foreground">
                    CVR {c.vat}
                    {c.city && ` · ${c.city}`}
                  </p>
                </ContextMenuGroup>
                <ContextMenuSeparator />

                <ContextMenuItem onClick={() => router.push(`/company/${c.vat}`)}>
                  <Eye className="size-4" />
                  {locale === "da" ? "Vis virksomhed" : "View company"}
                </ContextMenuItem>

                <ContextMenuItem onClick={() => { navigator.clipboard.writeText(c.vat); showToast(locale === "da" ? "CVR kopieret" : "CVR copied"); }}>
                  <Copy className="size-4" />
                  {locale === "da" ? "Kopiér CVR" : "Copy CVR"}
                </ContextMenuItem>

                <ContextMenuSeparator />

                <ContextMenuItem onClick={() => openNoteEditor(s.cvr, s.note)}>
                  <StickyNote className="size-4" />
                  {s.note ? sv.editNote : sv.addNote}
                </ContextMenuItem>

                <ContextMenuItem onClick={() => openTagEditor(s.cvr, s.tags ?? [])}>
                  <Tag className="size-4" />
                  {sv.editTags}
                </ContextMenuItem>

                <ContextMenuItem onClick={() => openTaskCreator(s.cvr, c.name)}>
                  <ListTodo className="size-4" />
                  {sv.createTask}
                </ContextMenuItem>

                {hasCrmConnections && (
                  <>
                    <ContextMenuSeparator />
                    {activeConnections.map((conn) => (
                      <ContextMenuItem
                        key={conn.id}
                        onClick={() => handleSinglePush(conn.id, c.id, conn.provider)}
                      >
                        <Upload className="size-4" />
                        {locale === "da" ? `Send til ${conn.provider}` : `Push to ${conn.provider}`}
                      </ContextMenuItem>
                    ))}
                  </>
                )}

                {c.industryName && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.city, "Denmark"].filter(Boolean).join(", "))}`, "_blank")}>
                      <ExternalLink className="size-4" />
                      {locale === "da" ? "Vis på kort" : "View on map"}
                    </ContextMenuItem>
                  </>
                )}

                <ContextMenuSeparator />
                <ContextMenuItem
                  variant="destructive"
                  onClick={() => handleRemove(s.cvr)}
                  disabled={removing === s.cvr}
                >
                  <Trash2 className="size-4" />
                  {locale === "da" ? "Fjern fra gemte" : "Remove from saved"}
                </ContextMenuItem>
              </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      )}
      {/* ── Floating Bulk Action Bar ────────────────────────── */}
      {selected.size > 0 && hasCrmConnections && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-3 px-5 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl shadow-black/20">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              {selected.size === filtered.length ? (
                <CheckSquare className="size-4" />
              ) : (
                <Square className="size-4" />
              )}
              {selected.size} {locale === "da" ? "valgt" : "selected"}
            </button>

            <div className="w-px h-5 bg-slate-700" />

            <button
              onClick={() => { if (!bulkPush.isPending) { setCrmPushTarget("selected"); setShowCrmDialog(true); } }}
              disabled={bulkPush.isPending}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {bulkPush.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowUpFromLine className="size-3.5" />
              )}
              {bulkPush.isPending
                ? (locale === "da" ? "Sender..." : "Pushing...")
                : (locale === "da" ? "Send til CRM" : "Push to CRM")}
            </button>

            <button
              onClick={() => setSelected(new Set())}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── CRM Push Dialog ─────────────────────────────────── */}
      <Dialog open={showCrmDialog} onOpenChange={setShowCrmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpFromLine className="size-5 text-indigo-600" />
              {locale === "da" ? "Send til CRM" : "Push to CRM"}
            </DialogTitle>
            <DialogDescription>
              {crmPushTarget === "selected"
                ? `${selected.size} ${locale === "da" ? "virksomheder valgt" : "companies selected"}`
                : `${filtered.length} ${locale === "da" ? "virksomheder" : "companies"}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {activeConnections.map((conn) => {
              const providerColors: Record<string, string> = {
                hubspot: "#FF7A59",
                leadconnector: "#FF6B35",
                pipedrive: "#017737",
              };
              const color = providerColors[conn.provider] ?? "#6366f1";
              const icons: Record<string, string> = {
                hubspot: "hub",
                leadconnector: "rocket_launch",
                pipedrive: "filter_alt",
              };

              return (
                <button
                  key={conn.id}
                  onClick={() => handleBulkPush(conn.id, conn.provider)}
                  disabled={bulkPush.isPending}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all disabled:opacity-50 text-left"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: color + "18" }}
                  >
                    <span className="material-symbols-outlined text-lg" style={{ color }}>
                      {icons[conn.provider] ?? "sync"}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900 capitalize">{conn.provider}</p>
                    <p className="text-[11px] text-slate-400">
                      {locale === "da" ? "Send virksomheder til" : "Push companies to"} {conn.provider}
                    </p>
                  </div>
                  {bulkPush.isPending ? (
                    <Loader2 className="size-4 animate-spin text-slate-400" />
                  ) : (
                    <ArrowRight className="size-4 text-slate-300" />
                  )}
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="rounded-xl" />}>
              {locale === "da" ? "Annuller" : "Cancel"}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </DashboardLayout>
    </VideoTrigger>
  );
}
