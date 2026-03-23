"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";
import { useLanguage } from "@/lib/i18n/language-context";
import { useSession } from "@/lib/auth-client";
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from "@/lib/hooks/use-todos";

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

type Filter = "all" | "active" | "completed";
type SortKey = "dueDate" | "priority" | "created";

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default function TodosPage() {
  const { t, locale } = useLanguage();
  const { data: session } = useSession();
  const router = useRouter();
  const d = t.todos;

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  // TanStack Query for todos data
  const { data: todosData, isLoading: loading } = useTodos();
  const createTodoMutation = useCreateTodo();
  const updateTodoMutation = useUpdateTodo();
  const deleteTodoMutation = useDeleteTodo();
  const todos = (todosData?.todos ?? []) as Todo[];

  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPriority, setFormPriority] = useState("medium");
  const [formCompanyCvr, setFormCompanyCvr] = useState("");
  const [formDueDate, setFormDueDate] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editDueDate, setEditDueDate] = useState("");

  // Sorting
  const sortTodos = (list: Todo[]) => {
    return [...list].sort((a, b) => {
      // Always push completed to bottom
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;

      if (sortKey === "priority") {
        return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
      }
      if (sortKey === "dueDate") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      // created (default) — newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  const filtered = sortTodos(
    todos.filter((t) => {
      if (filter === "active") return !t.isCompleted;
      if (filter === "completed") return t.isCompleted;
      return true;
    })
  );

  const activeCount = todos.filter((t) => !t.isCompleted).length;
  const completedCount = todos.filter((t) => t.isCompleted).length;

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormPriority("medium");
    setFormCompanyCvr("");
    setFormDueDate("");
    setShowForm(false);
  };

  const submitting = createTodoMutation.isPending || updateTodoMutation.isPending;

  const createTodo = () => {
    if (!formTitle.trim() || submitting) return;
    createTodoMutation.mutate(
      {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        priority: formPriority,
        dueDate: formDueDate || null,
      },
      {
        onSuccess: () => { resetForm(); showToast(d.created); },
        onError: () => showToast(d.createError),
      }
    );
  };

  const toggleComplete = (todo: Todo) => {
    updateTodoMutation.mutate(
      { id: todo.id, isCompleted: !todo.isCompleted },
      { onError: () => showToast(d.updateError) }
    );
  };

  const deleteTodo = (id: string) => {
    deleteTodoMutation.mutate(id, {
      onSuccess: () => showToast(d.deleted),
      onError: () => showToast(d.deleteError),
    });
  };

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
    setEditDescription(todo.description || "");
    setEditPriority(todo.priority);
    setEditDueDate(todo.dueDate || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    if (!editTitle.trim()) return;
    updateTodoMutation.mutate(
      {
        id,
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        priority: editPriority,
        dueDate: editDueDate || null,
      },
      {
        onSuccess: () => { setEditingId(null); showToast(d.updated); },
        onError: () => showToast(d.updateError),
      }
    );
  };

  const markAllComplete = async () => {
    const activeTodos = todos.filter((t) => !t.isCompleted);
    if (activeTodos.length === 0) return;
    try {
      await Promise.all(
        activeTodos.map((t) =>
          updateTodoMutation.mutateAsync({ id: t.id, isCompleted: true })
        )
      );
      showToast(`${activeTodos.length} ${d.bulkCompleted}`);
    } catch {
      showToast(d.updateError);
    }
  };

  const deleteCompleted = async () => {
    const completedTodos = todos.filter((t) => t.isCompleted);
    if (completedTodos.length === 0) return;
    try {
      await Promise.all(
        completedTodos.map((t) => deleteTodoMutation.mutateAsync(t.id))
      );
      showToast(`${completedTodos.length} ${d.bulkDeleted}`);
    } catch {
      showToast(d.deleteError);
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(locale === "da" ? "da-DK" : "en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const priorityStyles: Record<string, { bg: string; dot: string; label: string }> = {
    high: { bg: "bg-red-50 text-red-700 border-red-100", dot: "bg-red-500", label: d.high },
    medium: { bg: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-amber-500", label: d.medium },
    low: { bg: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500", label: d.low },
  };

  const stats = [
    { label: d.totalTasks, value: todos.length, icon: "task_alt", color: "bg-blue-50 text-blue-600" },
    { label: d.activeTasks, value: activeCount, icon: "pending_actions", color: "bg-amber-50 text-amber-600" },
    { label: d.completedTasks, value: completedCount, icon: "check_circle", color: "bg-emerald-50 text-emerald-600" },
  ];

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "created", label: d.sortCreated },
    { key: "dueDate", label: d.sortDueDate },
    { key: "priority", label: d.sortPriority },
  ];

  return (
    <DashboardLayout>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl text-sm font-medium flex items-center gap-2 animate-[fadeIn_0.2s]">
          <span className="material-symbols-outlined text-lg">info</span>
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)]">
            {d.title}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{d.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">sort</span>
              {d.sortBy}
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[160px]">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortKey(opt.key); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm cursor-pointer transition-colors ${
                        sortKey === opt.key
                          ? "bg-blue-50 text-blue-600 font-semibold"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            {d.newTask}
          </button>
        </div>
      </div>

      {/* New task form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5 sm:p-6 mb-6 sm:mb-8">
          <div className="space-y-4">
            <input
              type="text"
              placeholder={d.taskTitlePlaceholder}
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && createTodo()}
              autoFocus
              className="w-full text-base font-medium text-slate-900 placeholder:text-slate-300 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
            <textarea
              placeholder={d.descriptionPlaceholder}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={2}
              className="w-full text-sm text-slate-700 placeholder:text-slate-300 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{d.priority}</label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white cursor-pointer"
                >
                  <option value="high">{d.high}</option>
                  <option value="medium">{d.medium}</option>
                  <option value="low">{d.low}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{d.company}</label>
                <input
                  type="text"
                  placeholder={d.companyPlaceholder}
                  value={formCompanyCvr}
                  onChange={(e) => setFormCompanyCvr(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{d.dueDate}</label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={createTodo}
                disabled={!formTitle.trim() || submitting}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    {d.createTask}
                  </span>
                ) : (
                  d.createTask
                )}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {d.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                <span className="material-symbols-outlined text-xl">{stat.icon}</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">{stat.label}</p>
                <p className="text-xl font-extrabold text-slate-900 tabular-nums font-[family-name:var(--font-manrope)]">
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + bulk actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          {(["all", "active", "completed"] as Filter[]).map((f) => {
            const count = f === "all" ? todos.length : f === "active" ? activeCount : completedCount;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                  filter === f
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {d[f]} ({count})
              </button>
            );
          })}
        </div>
        {todos.length > 0 && (
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                onClick={markAllComplete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">done_all</span>
                {d.markAllComplete}
              </button>
            )}
            {completedCount > 0 && (
              <button
                onClick={deleteCompleted}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">delete_sweep</span>
                {d.deleteCompleted}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-3xl text-blue-600">
            progress_activity
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-200 mb-3 block">
            task_alt
          </span>
          <p className="text-slate-400 font-medium mb-4">
            {filter === "all" ? d.noTasks : filter === "active" ? d.noActive : d.noCompleted}
          </p>
          {filter === "all" && (
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              {d.createFirst}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((todo) => (
            <div
              key={todo.id}
              className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 ${
                todo.isCompleted
                  ? "border-slate-100/40 opacity-60"
                  : "border-slate-100/60 hover:shadow-md"
              }`}
            >
              {editingId === todo.id ? (
                /* Inline edit form */
                <div className="p-4 sm:p-5 space-y-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                    className="w-full text-sm font-medium text-slate-900 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder={d.descriptionPlaceholder}
                    rows={2}
                    className="w-full text-sm text-slate-700 placeholder:text-slate-300 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white cursor-pointer"
                    >
                      <option value="high">{d.high}</option>
                      <option value="medium">{d.medium}</option>
                      <option value="low">{d.low}</option>
                    </select>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => saveEdit(todo.id)}
                      disabled={!editTitle.trim() || submitting}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {d.saveChanges}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      {d.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                /* Task display */
                <div className="p-4 sm:p-5 flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleComplete(todo)}
                    className="mt-0.5 shrink-0 cursor-pointer"
                  >
                    {todo.isCompleted ? (
                      <span className="material-symbols-outlined text-xl text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-xl text-slate-300 hover:text-blue-500 transition-colors">
                        circle
                      </span>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${todo.isCompleted ? "line-through text-slate-400" : "text-slate-900"}`}>
                      {todo.title}
                    </p>

                    {/* Metadata badges */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {/* Priority */}
                      {(() => {
                        const ps = priorityStyles[todo.priority];
                        return ps ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${ps.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ps.dot}`} />
                            {ps.label}
                          </span>
                        ) : null;
                      })()}

                      {/* Company */}
                      {todo.company && (
                        <button
                          onClick={() => router.push(`/company/${todo.company!.vat}`)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">apartment</span>
                          {todo.company.name}
                          <span className="text-blue-400 font-normal">({todo.company.vat})</span>
                        </button>
                      )}

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
                    </div>

                    {/* Description */}
                    {todo.description && (
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        {todo.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(todo)}
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
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
