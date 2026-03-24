"use client";

import { useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";
import { useLanguage } from "@/lib/i18n/language-context";
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from "@/lib/hooks/use-todos";
import { useSavedCompanies } from "@/lib/hooks/use-saved-companies";
import { useTodoStore, type TodoFilter, type TodoSortKey } from "@/lib/stores/todo-store";

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

const PRIORITY_COLORS: Record<string, { border: string; bg: string; dot: string; text: string }> = {
  high: { border: "border-l-red-500", bg: "bg-red-50 text-red-700 border-red-100", dot: "bg-red-500", text: "text-red-600" },
  medium: { border: "border-l-amber-400", bg: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-amber-500", text: "text-amber-600" },
  low: { border: "border-l-emerald-400", bg: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500", text: "text-emerald-600" },
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
  const { data: savedData } = useSavedCompanies();
  const saved = savedData?.results ?? [];
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onToggle]);

  const filtered = saved.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = ((s.company as Record<string, unknown>)?.name as string) || "";
    return name.toLowerCase().includes(q) || s.cvr.includes(q);
  });

  // If a company is selected, show the badge
  if (selectedCvr && selectedName) {
    const color = getCompanyColor(selectedName);
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-sm`}>
          <div className={`w-6 h-6 rounded-full ${color.bg} flex items-center justify-center`}>
            <span className={`text-[9px] font-bold ${color.text}`}>{getInitials(selectedName)}</span>
          </div>
          <span className="font-medium text-slate-700">{selectedName}</span>
          <span className="text-slate-400 text-xs">({selectedCvr})</span>
          <button
            type="button"
            onClick={onRemove}
            className="ml-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer text-left"
      >
        <span className="material-symbols-outlined text-lg text-slate-400">apartment</span>
        <span>{d.selectCompany}</span>
        <span className="material-symbols-outlined text-sm ml-auto text-slate-300">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-scale-in">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <span className="material-symbols-outlined text-sm text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">search</span>
              <input
                type="text"
                placeholder={d.searchSavedCompanies}
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                autoFocus
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-100 rounded-lg text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          </div>

          {/* Saved companies */}
          <div className="max-h-48 overflow-y-auto">
            {saved.length > 0 && (
              <div className="px-3 pt-2 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{d.savedCompanies}</p>
              </div>
            )}
            {filtered.length === 0 && search && (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                {d.noSavedCompanies}
              </div>
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 transition-colors cursor-pointer text-left"
                >
                  <div className={`w-7 h-7 rounded-full ${color.bg} flex items-center justify-center shrink-0`}>
                    <span className={`text-[9px] font-bold ${color.text}`}>{getInitials(name)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{s.cvr}{city ? ` · ${city}` : ""}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Manual CVR */}
          <div className="border-t border-slate-100 p-2">
            <p className="text-[10px] font-medium text-slate-400 mb-1.5 px-1">{d.orEnterCvr}</p>
            <input
              type="text"
              placeholder="e.g. 12345678"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) onManualCvr(val);
                }
              }}
              className="w-full px-3 py-2 text-sm border border-slate-100 rounded-lg text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Progress Ring ─────────────────────────────────────────────────── */

function ProgressRing({ percent, size = 44, stroke = 4 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#progress-gradient)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
      />
      <defs>
        <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563eb" />
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

  // Zustand store
  const store = useTodoStore();

  // Toast
  const toastRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const showToast = useCallback((msg: string) => {
    if (toastRef.current) {
      toastRef.current.textContent = msg;
      toastRef.current.classList.remove("translate-y-2", "opacity-0");
      toastRef.current.classList.add("translate-y-0", "opacity-100");
    }
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      if (toastRef.current) {
        toastRef.current.classList.remove("translate-y-0", "opacity-100");
        toastRef.current.classList.add("translate-y-2", "opacity-0");
      }
    }, 3000);
  }, []);

  // TanStack Query
  const { data: todosData, isLoading: loading } = useTodos();
  const createMut = useCreateTodo();
  const updateMut = useUpdateTodo();
  const deleteMut = useDeleteTodo();
  const todos = (todosData?.todos ?? []) as Todo[];

  const submitting = createMut.isPending || updateMut.isPending;

  // Derived data
  const activeCount = todos.filter((t) => !t.isCompleted).length;
  const completedCount = todos.filter((t) => t.isCompleted).length;
  const completionPercent = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  // Sorting
  const sortTodos = (list: Todo[]) => {
    return [...list].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      if (store.sortKey === "priority") {
        return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
      }
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

  const sortOptions: { key: TodoSortKey; label: string; icon: string }[] = [
    { key: "created", label: d.sortCreated, icon: "schedule" },
    { key: "dueDate", label: d.sortDueDate, icon: "calendar_today" },
    { key: "priority", label: d.sortPriority, icon: "flag" },
  ];

  const stats = [
    { label: d.totalTasks, value: todos.length, icon: "task_alt", gradient: "from-blue-500 to-cyan-400" },
    { label: d.activeTasks, value: activeCount, icon: "pending_actions", gradient: "from-amber-500 to-orange-400" },
    { label: d.completedTasks, value: completedCount, icon: "check_circle", gradient: "from-emerald-500 to-teal-400" },
  ];

  return (
    <DashboardLayout>
      {/* Toast */}
      <div
        ref={toastRef}
        className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-2 transition-all duration-300 translate-y-2 opacity-0 pointer-events-none"
      >
        <span className="material-symbols-outlined text-lg text-emerald-400">check_circle</span>
      </div>

      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Progress ring */}
          <div className="relative hidden sm:flex items-center justify-center">
            <ProgressRing percent={completionPercent} size={52} stroke={4} />
            <span className="absolute text-xs font-bold text-slate-700">{completionPercent}%</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)]">
              {d.title}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">{d.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => store.setShowSortMenu(!store.showSortMenu)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">sort</span>
              {d.sortBy}
            </button>
            {store.showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => store.setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-slate-100 py-1 min-w-[180px] animate-dropdown">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => store.setSortKey(opt.key)}
                      className={`w-full text-left px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2.5 ${
                        store.sortKey === opt.key
                          ? "bg-blue-50 text-blue-600 font-semibold"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">{opt.icon}</span>
                      {opt.label}
                      {store.sortKey === opt.key && (
                        <span className="material-symbols-outlined text-sm ml-auto">check</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => store.setShowForm(!store.showForm)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-bold hover:from-blue-700 hover:to-blue-600 transition-all cursor-pointer shadow-sm shadow-blue-200"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            {d.newTask}
          </button>
        </div>
      </div>

      {/* ─── New Task Form ───────────────────────────────────── */}
      {store.showForm && (
        <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/40 border border-blue-100/80 p-5 sm:p-6 mb-8 ring-1 ring-blue-50 animate-slide-down">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg text-blue-600">add_task</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">{d.newTask}</h3>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              placeholder={d.taskTitlePlaceholder}
              value={store.form.title}
              onChange={(e) => store.setFormField("title", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && createTodo()}
              autoFocus
              className="w-full text-base font-medium text-slate-900 placeholder:text-slate-300 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
            <textarea
              placeholder={d.descriptionPlaceholder}
              value={store.form.description}
              onChange={(e) => store.setFormField("description", e.target.value)}
              rows={2}
              className="w-full text-sm text-slate-700 placeholder:text-slate-300 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">{d.priority}</label>
                <select
                  value={store.form.priority}
                  onChange={(e) => store.setFormField("priority", e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white cursor-pointer"
                >
                  <option value="high">{d.high}</option>
                  <option value="medium">{d.medium}</option>
                  <option value="low">{d.low}</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">{d.dueDate}</label>
                <input
                  type="date"
                  value={store.form.dueDate}
                  onChange={(e) => store.setFormField("dueDate", e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">{d.company}</label>
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
              <button
                onClick={createTodo}
                disabled={!store.form.title.trim() || submitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-bold hover:from-blue-700 hover:to-blue-600 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-blue-200"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    {d.createTask}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">add</span>
                    {d.createTask}
                  </span>
                )}
              </button>
              <button
                onClick={store.resetForm}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {d.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8 animate-stagger">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-sm`}>
                <span className="material-symbols-outlined text-xl text-white">{stat.icon}</span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{stat.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums font-[family-name:var(--font-manrope)]">
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
        {/* Completion rate card */}
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <ProgressRing percent={completionPercent} size={40} stroke={3.5} />
              <span className="absolute text-[10px] font-bold text-slate-600">{completionPercent}%</span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{d.completionRate}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-slate-900 tabular-nums font-[family-name:var(--font-manrope)]">
                  {completedCount}
                </span>
                <span className="text-sm text-slate-400 font-medium">/ {todos.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Filters & Bulk Actions ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-1.5 bg-slate-100/80 rounded-xl p-1">
          {(["all", "active", "completed"] as TodoFilter[]).map((f) => {
            const count = f === "all" ? todos.length : f === "active" ? activeCount : completedCount;
            return (
              <button
                key={f}
                onClick={() => store.setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  store.filter === f
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {d[f]}
                <span className={`ml-1.5 text-xs tabular-nums ${store.filter === f ? "text-blue-600" : "text-slate-400"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {todos.length > 0 && (
          <div className="flex items-center gap-1">
            {activeCount > 0 && (
              <button
                onClick={markAllComplete}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">done_all</span>
                {d.markAllComplete}
              </button>
            )}
            {completedCount > 0 && (
              <button
                onClick={deleteCompleted}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">delete_sweep</span>
                {d.deleteCompleted}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Task List ───────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">{d.fetchError}...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-20 text-center animate-fade-in-up">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-slate-300" style={{ fontVariationSettings: "'FILL' 1" }}>
              {store.filter === "completed" ? "check_circle" : store.filter === "active" ? "pending_actions" : "task_alt"}
            </span>
          </div>
          <p className="text-slate-500 font-semibold mb-1">
            {store.filter === "all" ? d.noTasks : store.filter === "active" ? d.noActive : d.noCompleted}
          </p>
          {store.filter === "all" && (
            <>
              <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">{d.noTasksDesc}</p>
              <button
                onClick={() => store.setShowForm(true)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-bold hover:from-blue-700 hover:to-blue-600 transition-all cursor-pointer shadow-sm shadow-blue-200"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">add</span>
                  {d.createFirst}
                </span>
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2.5 animate-stagger">
          {filtered.map((todo) => {
            const pColor = PRIORITY_COLORS[todo.priority] || PRIORITY_COLORS.medium;
            const isEditing = store.edit.editingId === todo.id;

            return (
              <div
                key={todo.id}
                className={`bg-white rounded-2xl shadow-sm border-l-[3px] border transition-all duration-200 ${
                  todo.isCompleted
                    ? "border-l-slate-200 border-slate-100/40 opacity-60"
                    : `${pColor.border} border-slate-100/60 hover:shadow-md`
                }`}
              >
                {isEditing ? (
                  /* ── Inline Edit ── */
                  <div className="p-4 sm:p-5 space-y-3 animate-fade-in-up">
                    <input
                      type="text"
                      value={store.edit.title}
                      onChange={(e) => store.setEditField("title", e.target.value)}
                      autoFocus
                      className="w-full text-sm font-medium text-slate-900 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    />
                    <textarea
                      value={store.edit.description}
                      onChange={(e) => store.setEditField("description", e.target.value)}
                      placeholder={d.descriptionPlaceholder}
                      rows={2}
                      className="w-full text-sm text-slate-700 placeholder:text-slate-300 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select
                        value={store.edit.priority}
                        onChange={(e) => store.setEditField("priority", e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white cursor-pointer"
                      >
                        <option value="high">{d.high}</option>
                        <option value="medium">{d.medium}</option>
                        <option value="low">{d.low}</option>
                      </select>
                      <input
                        type="date"
                        value={store.edit.dueDate}
                        onChange={(e) => store.setEditField("dueDate", e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
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
                      <button
                        onClick={() => saveEdit(todo.id)}
                        disabled={!store.edit.title.trim() || submitting}
                        className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        {d.saveChanges}
                      </button>
                      <button
                        onClick={store.cancelEdit}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {d.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Task Display ── */
                  <div className="p-4 sm:p-5 flex items-start gap-3">
                    {/* Checkbox */}
                    <button onClick={() => toggleComplete(todo)} className="mt-0.5 shrink-0 cursor-pointer group">
                      {todo.isCompleted ? (
                        <span className="material-symbols-outlined text-xl text-emerald-500 animate-check-pop" style={{ fontVariationSettings: "'FILL' 1" }}>
                          check_circle
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-xl text-slate-300 group-hover:text-blue-500 group-hover:scale-110 transition-all duration-200">
                          circle
                        </span>
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-snug transition-colors duration-300 ${todo.isCompleted ? "line-through text-slate-400 animate-strikethrough" : "text-slate-900"}`}>
                        {todo.title}
                      </p>

                      {todo.description && (
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                          {todo.description}
                        </p>
                      )}

                      {/* Metadata row */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {/* Priority badge */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${pColor.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pColor.dot}`} />
                          {d[todo.priority as "high" | "medium" | "low"]}
                        </span>

                        {/* Due date */}
                        {todo.dueDate && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              isOverdue(todo.dueDate) && !todo.isCompleted
                                ? "text-red-600 bg-red-50 border border-red-100"
                                : "text-slate-500 bg-slate-50 border border-slate-100"
                            }`}
                          >
                            <span className="material-symbols-outlined text-xs">calendar_today</span>
                            {formatDate(todo.dueDate)}
                            {isOverdue(todo.dueDate) && !todo.isCompleted && (
                              <span className="text-red-500 font-bold ml-0.5">{d.overdue}</span>
                            )}
                          </span>
                        )}

                        {/* Company badge */}
                        {todo.company && (() => {
                          const color = getCompanyColor(todo.company.name);
                          return (
                            <button
                              onClick={() => router.push(`/company/${todo.company!.vat}`)}
                              className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                            >
                              <div className={`w-4 h-4 rounded-full ${color.bg} flex items-center justify-center`}>
                                <span className={`text-[7px] font-bold ${color.text}`}>{getInitials(todo.company.name)}</span>
                              </div>
                              {todo.company.name}
                              <span className="text-blue-400 font-normal">({todo.company.vat})</span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {todo.company && (
                        <button
                          onClick={() => router.push(`/company/${todo.company!.vat}`)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title={d.viewCompany}
                        >
                          <span className="material-symbols-outlined text-lg">open_in_new</span>
                        </button>
                      )}
                      <button
                        onClick={() => store.startEdit(todo as Parameters<typeof store.startEdit>[0])}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title={d.edit}
                      >
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title={d.delete}
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
