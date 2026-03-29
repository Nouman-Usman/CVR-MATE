"use client";

import { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";
import { useLanguage } from "@/lib/i18n/language-context";
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from "@/lib/hooks/use-todos";
import { useSavedCompanies } from "@/lib/hooks/use-saved-companies";
import { useTodoStore, type TodoFilter, type TodoSortKey } from "@/lib/stores/todo-store";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuGroup,
} from "@/components/ui/context-menu";
import {
  Plus,
  ListTodo,
  Clock,
  CheckCircle2,
  CircleDot,
  Flag,
  Calendar,
  Building2,
  Loader2,
  Trash2,
  Pencil,
  ExternalLink,
  ArrowUpDown,
  Check,
  X,
  Search,
  CheckCheck,
  Trash,
  Eye,
  MoreHorizontal,
  Copy,
  MousePointerClick,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────── */

interface Company {
  id: string;
  vat: string;
  name: string;
  city: string | null;
}

interface Todo {
  id: string;
  title: string;
  description: string | null;
  isCompleted: boolean;
  priority: string;
  companyId: string | null;
  company: Company | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const PRIORITY_STYLES: Record<string, { badge: string; dot: string }> = {
  high: { badge: "bg-red-50 text-red-700 border-red-100", dot: "bg-red-500" },
  medium: { badge: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-amber-500" },
  low: { badge: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" },
};

const COMPANY_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-600" },
  { bg: "bg-violet-100", text: "text-violet-600" },
  { bg: "bg-cyan-100", text: "text-cyan-600" },
  { bg: "bg-amber-100", text: "text-amber-600" },
];

function getCompanyColor(name: string) {
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % COMPANY_COLORS.length;
  return COMPANY_COLORS[idx];
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/* ─── Company Picker ────────────────────────────────────────────────── */

function CompanyPickerDropdown({
  anchorRect,
  search,
  onSearch,
  onSelect,
  onManualCvr,
  onClose,
  d,
}: {
  anchorRect: DOMRect;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (companyId: string, cvr: string, name: string) => void;
  onManualCvr: (cvr: string) => void;
  onClose: () => void;
  d: Record<string, string>;
}) {
  const { data: savedData } = useSavedCompanies();
  const saved = savedData?.results ?? [];
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [manualCvr, setManualCvr] = useState("");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = saved.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = ((s.company as Record<string, unknown>)?.name as string) || "";
    return name.toLowerCase().includes(q) || s.cvr.includes(q);
  });

  const top = anchorRect.bottom + 4;
  const left = anchorRect.left;
  const width = Math.max(anchorRect.width, 300);

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed bg-popover rounded-xl shadow-xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{ top, left, width, zIndex: 9999 }}
    >
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            placeholder={d.searchSavedCompanies}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            autoFocus
            className="h-9 pl-8 text-sm rounded-lg"
          />
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {saved.length > 0 && (
          <div className="px-3 pt-2 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{d.savedCompanies}</p>
          </div>
        )}
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">{d.noSavedCompanies}</div>
        )}
        {filtered.map((s) => {
          const name = ((s.company as Record<string, unknown>)?.name as string) || s.cvr;
          const city = ((s.company as Record<string, unknown>)?.city as string) || "";
          const companyId = ((s.company as Record<string, unknown>)?.id as string) || "";
          const color = getCompanyColor(name);
          return (
            <button
              key={s.cvr}
              type="button"
              onClick={() => onSelect(companyId, s.cvr, name)}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors cursor-pointer text-left"
            >
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", color.bg)}>
                <span className={cn("text-[9px] font-bold", color.text)}>{getInitials(name)}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{s.cvr}{city ? ` · ${city}` : ""}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="border-t border-border p-2">
        <p className="text-[10px] font-medium text-muted-foreground mb-1.5 px-1">{d.orEnterCvr}</p>
        <div className="flex gap-1.5">
          <Input
            type="text"
            placeholder="e.g. 12345678"
            value={manualCvr}
            onChange={(e) => setManualCvr(e.target.value.replace(/\D/g, "").slice(0, 8))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manualCvr.trim()) {
                onManualCvr(manualCvr.trim());
                setManualCvr("");
              }
            }}
            className="h-9 text-sm rounded-lg"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (manualCvr.trim()) {
                onManualCvr(manualCvr.trim());
                setManualCvr("");
              }
            }}
            disabled={!manualCvr.trim()}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CompanyPicker({
  isOpen,
  search,
  selectedCvr,
  selectedName,
  onToggle,
  onSearch,
  onSelect,
  onRemove,
  onManualCvr,
  d,
}: {
  isOpen: boolean;
  search: string;
  selectedCvr: string;
  selectedName: string;
  onToggle: () => void;
  onSearch: (v: string) => void;
  onSelect: (companyId: string, cvr: string, name: string) => void;
  onRemove: () => void;
  onManualCvr: (cvr: string) => void;
  d: Record<string, string>;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const handleToggle = useCallback(() => {
    if (!isOpen && buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
    }
    onToggle();
  }, [isOpen, onToggle]);

  const handleClose = useCallback(() => {
    if (isOpen) onToggle();
  }, [isOpen, onToggle]);

  if (selectedCvr && selectedName) {
    const color = getCompanyColor(selectedName);
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="gap-2 pl-1 pr-1 py-1 h-auto border-0">
          <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", color.bg)}>
            <span className={cn("text-[9px] font-bold", color.text)}>{getInitials(selectedName)}</span>
          </div>
          <span className="font-medium text-foreground truncate max-w-[160px]">{selectedName}</span>
          <span className="text-muted-foreground text-xs">({selectedCvr})</span>
          <button
            type="button"
            onClick={onRemove}
            className="ml-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </Badge>
      </div>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center gap-2 border border-input rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:border-ring hover:bg-muted/30 transition-all cursor-pointer text-left"
      >
        <Building2 className="size-4 text-muted-foreground/60" />
        <span>{d.selectCompany}</span>
      </button>
      {isOpen && anchorRect && (
        <CompanyPickerDropdown
          anchorRect={anchorRect}
          search={search}
          onSearch={onSearch}
          onSelect={onSelect}
          onManualCvr={onManualCvr}
          onClose={handleClose}
          d={d}
        />
      )}
    </>
  );
}

/* ─── Progress Ring ─────────────────────────────────────────────────── */

function ProgressRing({ percent, size = 44, stroke = 4 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-muted" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#progress-gradient)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
      />
      <defs>
        <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */

export default function TodosPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const d = t.todos;

  const store = useTodoStore();

  // Toast
  const [toast, setToast] = useState("");
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  // TanStack Query
  const { data: todosData, isLoading: loading } = useTodos();
  const createMut = useCreateTodo();
  const updateMut = useUpdateTodo();
  const deleteMut = useDeleteTodo();
  const todos = (todosData?.todos ?? []) as Todo[];

  const submitting = createMut.isPending || updateMut.isPending;

  // Detail view dialog
  const [viewingTodo, setViewingTodo] = useState<Todo | null>(null);

  // Derived data
  const activeCount = todos.filter((t) => !t.isCompleted).length;
  const completedCount = todos.filter((t) => t.isCompleted).length;
  const completionPercent = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;
  const overdueCount = todos.filter((t) => !t.isCompleted && t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString())).length;

  // Sorting
  const sortTodos = (list: Todo[]) => {
    return [...list].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      if (store.sortKey === "priority") return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
      if (store.sortKey === "dueDate") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  const filtered = sortTodos(
    todos.filter((t) => {
      if (store.filter === "active") return !t.isCompleted;
      if (store.filter === "completed") return t.isCompleted;
      return true;
    })
  );

  // Helpers
  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
  };

  const formatDate = (date: string) => {
    const d2 = new Date(date);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (d2.toDateString() === today.toDateString()) return d.dueToday;
    if (d2.toDateString() === tomorrow.toDateString()) return d.dueTomorrow;
    return d2.toLocaleDateString(locale === "da" ? "da-DK" : "en-US", { month: "short", day: "numeric" });
  };

  // CRUD
  const createTodo = () => {
    if (!store.form.title.trim() || submitting) return;
    createMut.mutate(
      {
        title: store.form.title.trim(),
        description: store.form.description.trim() || null,
        priority: store.form.priority,
        dueDate: store.form.dueDate || null,
        ...(store.form.companyId ? { companyId: store.form.companyId } : store.form.companyCvr ? { cvr: store.form.companyCvr } : {}),
      },
      {
        onSuccess: () => { store.resetForm(); showToast(d.created); },
        onError: () => showToast(d.createError),
      }
    );
  };

  const toggleComplete = (todo: Todo) => {
    updateMut.mutate(
      { id: todo.id, isCompleted: !todo.isCompleted },
      { onError: () => showToast(d.updateError) }
    );
  };

  const deleteTodo = (id: string) => {
    deleteMut.mutate(id, {
      onSuccess: () => showToast(d.deleted),
      onError: () => showToast(d.deleteError),
    });
  };

  const saveEdit = (id: string) => {
    if (!store.edit.title.trim()) return;
    updateMut.mutate(
      {
        id,
        title: store.edit.title.trim(),
        description: store.edit.description.trim() || null,
        priority: store.edit.priority,
        dueDate: store.edit.dueDate || null,
        ...(store.edit.companyId !== undefined ? { companyId: store.edit.companyId } : store.edit.companyCvr ? { cvr: store.edit.companyCvr } : {}),
      },
      {
        onSuccess: () => { store.cancelEdit(); showToast(d.updated); },
        onError: () => showToast(d.updateError),
      }
    );
  };

  const markAllComplete = async () => {
    const active = todos.filter((t) => !t.isCompleted);
    if (active.length === 0) return;
    try {
      await Promise.all(active.map((t) => updateMut.mutateAsync({ id: t.id, isCompleted: true })));
      showToast(`${active.length} ${d.bulkCompleted}`);
    } catch { showToast(d.updateError); }
  };

  const deleteCompleted = async () => {
    const done = todos.filter((t) => t.isCompleted);
    if (done.length === 0) return;
    try {
      await Promise.all(done.map((t) => deleteMut.mutateAsync(t.id)));
      showToast(`${done.length} ${d.bulkDeleted}`);
    } catch { showToast(d.deleteError); }
  };

  const sortOptions: { key: TodoSortKey; label: string; icon: typeof Clock }[] = [
    { key: "created", label: d.sortCreated, icon: Clock },
    { key: "dueDate", label: d.sortDueDate, icon: Calendar },
    { key: "priority", label: d.sortPriority, icon: Flag },
  ];

  return (
    <DashboardLayout>
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-foreground text-background px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="size-4 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* ── Detail Dialog ─────────────────────────────────────── */}
      <Dialog open={viewingTodo !== null} onOpenChange={(open) => { if (!open) setViewingTodo(null); }}>
        <DialogContent className="sm:max-w-lg">
          {viewingTodo && (() => {
            const pStyle = PRIORITY_STYLES[viewingTodo.priority] || PRIORITY_STYLES.medium;
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className={cn("border text-[10px] font-bold uppercase tracking-wider h-5", pStyle.badge)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full mr-1", pStyle.dot)} />
                      {d[viewingTodo.priority as "high" | "medium" | "low"]}
                    </Badge>
                    {viewingTodo.isCompleted && (
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] font-bold uppercase tracking-wider h-5">
                        <CheckCircle2 className="size-3 mr-1" />
                        {d.completed}
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="text-lg">{viewingTodo.title}</DialogTitle>
                  {viewingTodo.description && (
                    <DialogDescription className="mt-2 whitespace-pre-wrap">{viewingTodo.description}</DialogDescription>
                  )}
                </DialogHeader>

                <div className="space-y-3 pt-2">
                  {/* Due date */}
                  {viewingTodo.dueDate && (
                    <div className="flex items-center gap-3">
                      <Calendar className="size-4 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{d.dueDate}</p>
                        <p className={cn(
                          "text-sm font-medium",
                          isOverdue(viewingTodo.dueDate) && !viewingTodo.isCompleted ? "text-destructive" : "text-foreground"
                        )}>
                          {formatDate(viewingTodo.dueDate)}
                          {isOverdue(viewingTodo.dueDate) && !viewingTodo.isCompleted && (
                            <span className="text-destructive font-bold ml-2">{d.overdue}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Company */}
                  {viewingTodo.company && (() => {
                    const color = getCompanyColor(viewingTodo.company.name);
                    return (
                      <div className="flex items-center gap-3">
                        <Building2 className="size-4 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{d.company}</p>
                          <button
                            onClick={() => { setViewingTodo(null); router.push(`/company/${viewingTodo.company!.vat}`); }}
                            className="flex items-center gap-2 text-sm font-medium text-primary hover:underline cursor-pointer"
                          >
                            <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", color.bg)}>
                              <span className={cn("text-[8px] font-bold", color.text)}>{getInitials(viewingTodo.company.name)}</span>
                            </div>
                            {viewingTodo.company.name}
                            <span className="text-muted-foreground font-normal">({viewingTodo.company.vat})</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Created */}
                  <div className="flex items-center gap-3">
                    <Clock className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {locale === "da" ? "Oprettet" : "Created"}
                      </p>
                      <p className="text-sm text-foreground">
                        {new Date(viewingTodo.createdAt).toLocaleDateString(
                          locale === "da" ? "da-DK" : "en-US",
                          { year: "numeric", month: "long", day: "numeric" }
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <DialogClose render={<Button variant="outline" className="rounded-xl" />}>
                    {d.cancel}
                  </DialogClose>
                  <Button
                    className="rounded-xl gap-1.5"
                    onClick={() => {
                      toggleComplete(viewingTodo);
                      setViewingTodo(null);
                    }}
                  >
                    {viewingTodo.isCompleted ? (
                      <><CircleDot className="size-4" />{locale === "da" ? "Marker som aktiv" : "Mark active"}</>
                    ) : (
                      <><CheckCircle2 className="size-4" />{locale === "da" ? "Marker som færdig" : "Mark complete"}</>
                    )}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)]">
            {d.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">{d.subtitle}</p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Sort dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              className="rounded-xl gap-1.5"
              onClick={() => store.setShowSortMenu(!store.showSortMenu)}
            >
              <ArrowUpDown className="size-4" />
              {d.sortBy}
            </Button>
            {store.showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => store.setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-popover rounded-xl shadow-xl border border-border py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-150">
                  {sortOptions.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => store.setSortKey(opt.key)}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2.5",
                          store.sortKey === opt.key
                            ? "bg-primary/5 text-primary font-semibold"
                            : "text-foreground hover:bg-muted/50"
                        )}
                      >
                        <Icon className="size-4" />
                        {opt.label}
                        {store.sortKey === opt.key && <Check className="size-3.5 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <Button
            variant="gradient"
            className="rounded-xl gap-2"
            onClick={() => store.setShowForm(!store.showForm)}
          >
            <Plus className="size-4" />
            {d.newTask}
          </Button>
        </div>
      </div>

      {/* ── New Task Form ───────────────────────────────────── */}
      {store.showForm && (
        <Card className="border-primary/20 shadow-sm mb-8 py-0">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plus className="size-4 text-primary" />
              </div>
              <h3 className="text-sm font-bold text-foreground">{d.newTask}</h3>
            </div>
            <div className="space-y-4">
              <Input
                placeholder={d.taskTitlePlaceholder}
                value={store.form.title}
                onChange={(e) => store.setFormField("title", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && createTodo()}
                autoFocus
                className="h-12 rounded-xl text-base font-medium"
              />
              <Textarea
                placeholder={d.descriptionPlaceholder}
                value={store.form.description}
                onChange={(e) => store.setFormField("description", e.target.value)}
                rows={2}
                className="rounded-xl"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{d.priority}</label>
                  <select
                    value={store.form.priority}
                    onChange={(e) => store.setFormField("priority", e.target.value)}
                    className="w-full border border-input rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring bg-background cursor-pointer transition-colors"
                  >
                    <option value="high">{d.high}</option>
                    <option value="medium">{d.medium}</option>
                    <option value="low">{d.low}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{d.dueDate}</label>
                  <input
                    type="date"
                    value={store.form.dueDate}
                    onChange={(e) => store.setFormField("dueDate", e.target.value)}
                    className="w-full border border-input rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring bg-background cursor-pointer transition-colors"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{d.company}</label>
                  <CompanyPicker
                    isOpen={store.picker.isOpen}
                    search={store.picker.search}
                    selectedCvr={store.form.companyCvr}
                    selectedName={store.form.companyName}
                    onToggle={() => store.setPicker({ isOpen: !store.picker.isOpen })}
                    onSearch={(v) => store.setPicker({ search: v })}
                    onSelect={(id, cvr, name) => store.setFormCompany(id, cvr, name)}
                    onRemove={() => store.setFormCompany(null, "", "")}
                    onManualCvr={(cvr) => store.setFormCompany(null, cvr, `CVR ${cvr}`)}
                    d={d}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="gradient"
                  className="rounded-xl gap-2"
                  onClick={createTodo}
                  disabled={!store.form.title.trim() || submitting}
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  {d.createTask}
                </Button>
                <Button variant="ghost" className="rounded-xl" onClick={store.resetForm}>
                  {d.cancel}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Stats ───────────────────────────────────────────── */}
      {!loading && todos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <ListTodo className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">{todos.length}</p>
                <p className="text-[11px] text-muted-foreground font-medium">{d.totalTasks}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <CircleDot className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">{activeCount}</p>
                <p className="text-[11px] text-muted-foreground font-medium">{d.activeTasks}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">{completedCount}</p>
                <p className="text-[11px] text-muted-foreground font-medium">{d.completedTasks}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <ProgressRing percent={completionPercent} size={40} stroke={3.5} />
                <span className="absolute text-[10px] font-bold text-foreground">{completionPercent}%</span>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">{d.completionRate}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">{completedCount}</span>
                  <span className="text-sm text-muted-foreground font-medium">/ {todos.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Filters & Bulk Actions ──────────────────────────── */}
      {!loading && todos.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-1.5 bg-muted/60 rounded-xl p-1">
            {(["all", "active", "completed"] as TodoFilter[]).map((f) => {
              const count = f === "all" ? todos.length : f === "active" ? activeCount : completedCount;
              return (
                <button
                  key={f}
                  onClick={() => store.setFilter(f)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer",
                    store.filter === f
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {d[f]}
                  <span className={cn("ml-1.5 text-xs tabular-nums", store.filter === f ? "text-primary" : "text-muted-foreground/60")}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-xs" onClick={markAllComplete}>
                <CheckCheck className="size-3.5" />
                {d.markAllComplete}
              </Button>
            )}
            {completedCount > 0 && (
              <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5" onClick={deleteCompleted}>
                <Trash className="size-3.5" />
                {d.deleteCompleted}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────── */}
      {loading && (
        <Card className="border-0 shadow-sm py-0">
          <CardContent className="p-0">
            <div className="p-5 space-y-0 divide-y divide-border/30">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <Skeleton className="w-5 h-5 rounded shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full hidden sm:block" />
                  <Skeleton className="h-5 w-16 rounded-full hidden sm:block" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {!loading && filtered.length === 0 && (
        <Card className="py-16 border-0 shadow-sm">
          <CardContent className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              {store.filter === "completed" ? (
                <CheckCircle2 className="size-7 text-muted-foreground/30" />
              ) : store.filter === "active" ? (
                <CircleDot className="size-7 text-muted-foreground/30" />
              ) : (
                <ListTodo className="size-7 text-muted-foreground/30" />
              )}
            </div>
            <p className="text-foreground font-semibold mb-1">
              {store.filter === "all" ? d.noTasks : store.filter === "active" ? d.noActive : d.noCompleted}
            </p>
            {store.filter === "all" && (
              <>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-5">{d.noTasksDesc}</p>
                <Button variant="gradient" className="rounded-xl gap-2" onClick={() => store.setShowForm(true)}>
                  <Plus className="size-4" />
                  {d.createFirst}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Task Table ──────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <>
        <Card className="overflow-hidden border-0 shadow-sm py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="w-12 pl-5" />
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {d.taskTitle}
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden sm:table-cell w-24">
                  {d.priority}
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell w-28">
                  {d.dueDate}
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                  {d.company}
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((todo) => {
                const pStyle = PRIORITY_STYLES[todo.priority] || PRIORITY_STYLES.medium;
                const isEditing = store.edit.editingId === todo.id;

                if (isEditing) {
                  return (
                    <TableRow key={todo.id} className="border-border/30 hover:bg-transparent">
                      <TableCell colSpan={6} className="p-4 sm:p-5">
                        <div className="space-y-3">
                          <Input
                            value={store.edit.title}
                            onChange={(e) => store.setEditField("title", e.target.value)}
                            autoFocus
                            className="h-10 rounded-xl font-medium"
                          />
                          <Textarea
                            value={store.edit.description}
                            onChange={(e) => store.setEditField("description", e.target.value)}
                            placeholder={d.descriptionPlaceholder}
                            rows={2}
                            className="rounded-xl"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <select
                              value={store.edit.priority}
                              onChange={(e) => store.setEditField("priority", e.target.value)}
                              className="w-full border border-input rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring bg-background cursor-pointer"
                            >
                              <option value="high">{d.high}</option>
                              <option value="medium">{d.medium}</option>
                              <option value="low">{d.low}</option>
                            </select>
                            <input
                              type="date"
                              value={store.edit.dueDate}
                              onChange={(e) => store.setEditField("dueDate", e.target.value)}
                              className="w-full border border-input rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring bg-background cursor-pointer"
                            />
                            <CompanyPicker
                              isOpen={store.editPicker.isOpen}
                              search={store.editPicker.search}
                              selectedCvr={store.edit.companyCvr}
                              selectedName={store.edit.companyName}
                              onToggle={() => store.setEditPicker({ isOpen: !store.editPicker.isOpen })}
                              onSearch={(v) => store.setEditPicker({ search: v })}
                              onSelect={(id, cvr, name) => store.setEditCompany(id, cvr, name)}
                              onRemove={() => store.setEditCompany(null, "", "")}
                              onManualCvr={(cvr) => store.setEditCompany(null, cvr, `CVR ${cvr}`)}
                              d={d}
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <Button className="rounded-xl" onClick={() => saveEdit(todo.id)} disabled={!store.edit.title.trim() || submitting}>
                              {d.saveChanges}
                            </Button>
                            <Button variant="ghost" className="rounded-xl" onClick={store.cancelEdit}>
                              {d.cancel}
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <ContextMenu key={todo.id}>
                    <ContextMenuTrigger render={
                      <TableRow
                        className={cn(
                          "group border-border/30 cursor-default",
                          todo.isCompleted && "opacity-50",
                          !todo.isCompleted && todo.priority === "high" && "border-l-2 border-l-red-400",
                          !todo.isCompleted && todo.priority === "medium" && "border-l-2 border-l-amber-400",
                          !todo.isCompleted && todo.priority === "low" && "border-l-2 border-l-emerald-400",
                        )}
                        onDoubleClick={() => setViewingTodo(todo)}
                      />
                    }>
                      {/* Checkbox */}
                      <TableCell className="pl-5 py-3.5">
                        <Checkbox
                          checked={todo.isCompleted}
                          onCheckedChange={() => toggleComplete(todo)}
                          className="size-5 rounded-md"
                        />
                      </TableCell>

                      {/* Title + description */}
                      <TableCell className="py-3.5 !whitespace-normal">
                        <div className="min-w-0 max-w-md">
                          <p className={cn(
                            "text-sm font-semibold leading-snug transition-colors",
                            todo.isCompleted ? "line-through text-muted-foreground" : "text-foreground"
                          )}>
                            {todo.title}
                          </p>
                          {todo.description && (
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">{todo.description}</p>
                          )}
                          {/* Mobile: inline badges */}
                          <div className="flex items-center gap-1.5 mt-1.5 sm:hidden flex-wrap">
                            <Badge variant="secondary" className={cn("border text-[9px] font-bold uppercase tracking-wider h-5", pStyle.badge)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full mr-1", pStyle.dot)} />
                              {d[todo.priority as "high" | "medium" | "low"]}
                            </Badge>
                            {todo.dueDate && (
                              <Badge variant="secondary" className={cn(
                                "text-[9px] font-semibold h-5 border",
                                isOverdue(todo.dueDate) && !todo.isCompleted ? "bg-red-50 text-red-600 border-red-100" : "border-border/60"
                              )}>
                                {formatDate(todo.dueDate)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Priority */}
                      <TableCell className="py-3.5 hidden sm:table-cell">
                        <Badge variant="secondary" className={cn("border text-[9px] font-bold uppercase tracking-wider h-5", pStyle.badge)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full mr-1", pStyle.dot)} />
                          {d[todo.priority as "high" | "medium" | "low"]}
                        </Badge>
                      </TableCell>

                      {/* Due date */}
                      <TableCell className="py-3.5 hidden md:table-cell">
                        {todo.dueDate ? (
                          <span className={cn(
                            "text-sm",
                            isOverdue(todo.dueDate) && !todo.isCompleted ? "text-destructive font-semibold" : "text-muted-foreground"
                          )}>
                            {formatDate(todo.dueDate)}
                            {isOverdue(todo.dueDate) && !todo.isCompleted && (
                              <span className="text-destructive font-bold ml-1 text-xs">!</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">–</span>
                        )}
                      </TableCell>

                      {/* Company */}
                      <TableCell className="py-3.5 hidden lg:table-cell">
                        {todo.company ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/company/${todo.company!.vat}`); }}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
                          >
                            {todo.company.name}
                          </button>
                        ) : (
                          <span className="text-muted-foreground/40">–</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3.5 pr-4">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-muted/50"
                            onClick={() => setViewingTodo(todo)}
                            title={locale === "da" ? "Se detaljer" : "View details"}
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-muted/50"
                            onClick={() => store.startEdit(todo as Parameters<typeof store.startEdit>[0])}
                            title={d.edit}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </ContextMenuTrigger>

                    <ContextMenuContent className="w-56">
                      <ContextMenuGroup>
                        <ContextMenuLabel>{todo.title.length > 30 ? todo.title.slice(0, 30) + "..." : todo.title}</ContextMenuLabel>
                        {todo.description && (
                          <p className="px-1.5 pb-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {todo.description}
                          </p>
                        )}
                      </ContextMenuGroup>
                      <ContextMenuSeparator />

                      <ContextMenuItem onClick={() => setViewingTodo(todo)}>
                        <Eye className="size-4" />
                        {locale === "da" ? "Se detaljer" : "View details"}
                      </ContextMenuItem>

                      <ContextMenuItem onClick={() => toggleComplete(todo)}>
                        {todo.isCompleted ? (
                          <><CircleDot className="size-4" />{locale === "da" ? "Marker som aktiv" : "Mark active"}</>
                        ) : (
                          <><CheckCircle2 className="size-4" />{locale === "da" ? "Marker som færdig" : "Mark complete"}</>
                        )}
                      </ContextMenuItem>

                      <ContextMenuItem onClick={() => store.startEdit(todo as Parameters<typeof store.startEdit>[0])}>
                        <Pencil className="size-4" />
                        {d.edit}
                      </ContextMenuItem>

                      <ContextMenuItem onClick={() => { navigator.clipboard.writeText(todo.title); showToast(locale === "da" ? "Kopieret" : "Copied"); }}>
                        <Copy className="size-4" />
                        {locale === "da" ? "Kopier titel" : "Copy title"}
                      </ContextMenuItem>

                      {todo.company && (
                        <>
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => router.push(`/company/${todo.company!.vat}`)}>
                            <ExternalLink className="size-4" />
                            {d.viewCompany}
                          </ContextMenuItem>
                        </>
                      )}

                      <ContextMenuSeparator />
                      <ContextMenuItem variant="destructive" onClick={() => deleteTodo(todo.id)}>
                        <Trash2 className="size-4" />
                        {d.delete}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {/* Context menu hint */}
        <div className="flex items-center justify-center gap-2 mt-4 text-[11px] text-muted-foreground/50">
          <MousePointerClick className="size-3.5" />
          <span>{locale === "da" ? "Dobbeltklik for detaljer · Højreklik for flere muligheder" : "Double-click to view details · Right-click for more options"}</span>
        </div>
        </>
      )}
    </DashboardLayout>
  );
}
