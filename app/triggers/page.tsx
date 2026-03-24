"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import {
  useTriggers,
  useCreateTrigger,
  useUpdateTrigger,
  useDeleteTrigger,
  useRunTrigger,
  type Trigger,
} from "@/lib/hooks/use-triggers";

type NotificationChannel = "in_app" | "email";

interface TriggerFilters {
  industry_code?: string;
  city?: string;
  region?: string;
  company_type?: string;
  min_employees?: number;
  max_employees?: number;
  founded_after?: string;
}

const emptyFilters: TriggerFilters = {};

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export default function TriggersPage() {
  const { t, locale } = useLanguage();
  const tr = t.triggers;

  // Data
  const { data, isLoading } = useTriggers();
  const triggers = (data?.triggers ?? []) as Trigger[];

  // Mutations
  const createMutation = useCreateTrigger();
  const updateMutation = useUpdateTrigger();
  const deleteMutation = useDeleteTrigger();
  const runMutation = useRunTrigger();

  // UI state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Trigger | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [filters, setFilters] = useState<TriggerFilters>(emptyFilters);
  const [channels, setChannels] = useState<NotificationChannel[]>(["in_app"]);
  const [scheduledHour, setScheduledHour] = useState(8);
  const [scheduledMinute, setScheduledMinute] = useState(0);
  const [scheduledDayOfWeek, setScheduledDayOfWeek] = useState(1); // Monday

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setFrequency("daily");
    setFilters(emptyFilters);
    setChannels(["in_app"]);
    setScheduledHour(8);
    setScheduledMinute(0);
    setScheduledDayOfWeek(1);
    setDialogOpen(true);
  };

  const openEdit = (trigger: Trigger) => {
    setEditing(trigger);
    setName(trigger.name);
    setFrequency(trigger.frequency);
    setFilters((trigger.filters ?? {}) as TriggerFilters);
    setChannels((trigger.notificationChannels ?? ["in_app"]) as NotificationChannel[]);
    setScheduledHour(trigger.scheduledHour ?? 8);
    setScheduledMinute(trigger.scheduledMinute ?? 0);
    setScheduledDayOfWeek(trigger.scheduledDayOfWeek ?? 1);
    setDialogOpen(true);
  };

  const toggleChannel = (channel: NotificationChannel) => {
    setChannels((prev) => {
      if (prev.includes(channel)) {
        if (prev.length <= 1) return prev;
        return prev.filter((c) => c !== channel);
      }
      return [...prev, channel];
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      frequency,
      filters,
      notificationChannels: channels,
      scheduledHour,
      scheduledMinute,
      scheduledDayOfWeek: frequency === "weekly" ? scheduledDayOfWeek : null,
    };

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, ...payload },
        {
          onSuccess: () => {
            setDialogOpen(false);
            showToast(tr.updated);
          },
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          setDialogOpen(false);
          showToast(tr.created);
        },
      });
    }
  };

  const handleToggle = (trigger: Trigger) => {
    updateMutation.mutate({ id: trigger.id, isActive: !trigger.isActive });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => showToast(tr.deleted),
    });
  };

  const handleRun = (id: string) => {
    runMutation.mutate(id, {
      onSuccess: (data) => {
        const count = data?.result?.matchCount ?? 0;
        showToast(`${tr.runSuccess} — ${count} ${tr.runResults}`);
      },
      onError: () => showToast(tr.runError),
    });
  };

  const filterCount = (f: TriggerFilters) =>
    Object.values(f).filter((v) => v !== undefined && v !== "").length;

  const saving = createMutation.isPending || updateMutation.isPending;
  const runningId = runMutation.isPending ? (runMutation.variables ?? null) : null;

  const getLatestResult = (trigger: Trigger) => {
    const results = (trigger as Trigger & { results?: { matchCount: number; companies: { vat: number; name: string; city: string; industry: string }[]; createdAt: string }[] }).results;
    return results?.[0] ?? null;
  };

  const formatSchedule = (trigger: Trigger) => {
    const time = `${pad2(trigger.scheduledHour ?? 8)}:${pad2(trigger.scheduledMinute ?? 0)}`;
    if (trigger.frequency === "weekly" && trigger.scheduledDayOfWeek !== null) {
      const dayKey = DAY_KEYS[trigger.scheduledDayOfWeek ?? 1];
      const dayName = tr[dayKey as keyof typeof tr] || dayKey;
      return `${tr.everyWeekOn} ${dayName} ${tr.at} ${time}`;
    }
    return `${tr.everyDayAt} ${time}`;
  };

  const formatNextRun = (trigger: Trigger) => {
    if (!trigger.nextRunAt) return null;
    const d = new Date(trigger.nextRunAt);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffH = Math.round(diffMs / 3600000);

    const dateStr = d.toLocaleDateString(locale === "da" ? "da-DK" : "en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (diffH > 0 && diffH < 24) {
      return `${dateStr} (${diffH}h)`;
    }
    return dateStr;
  };

  // Hours & minutes for selectors
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  return (
    <DashboardLayout>
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-fade-in-up">
          <span className="material-symbols-outlined text-lg text-emerald-400">check_circle</span>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)]">
            {tr.title}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{tr.subtitle}</p>
        </div>
        <button
          onClick={openCreate}
          className="self-start flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-full hover:scale-[1.02] transition-all shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          {tr.newTrigger}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-16 text-center">
          <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-slate-400 font-medium">...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && triggers.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-20 text-center animate-fade-in-up">
          <span className="material-symbols-outlined text-6xl text-slate-200 mb-4 block">
            bolt
          </span>
          <p className="text-slate-400 font-medium mb-6">{tr.noTriggers}</p>
          <button
            onClick={openCreate}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-full hover:scale-[1.02] transition-all cursor-pointer"
          >
            {tr.createFirst}
          </button>
        </div>
      ) : !isLoading && (
        <div className="space-y-3 animate-stagger">
          {triggers.map((trigger) => {
            const latestResult = getLatestResult(trigger);
            const nextRun = formatNextRun(trigger);
            return (
              <div
                key={trigger.id}
                className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 overflow-hidden"
              >
                {/* Trigger row */}
                <div className="p-4 sm:p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(trigger)}
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
                        trigger.isActive ? "bg-blue-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                          trigger.isActive ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-900 truncate">
                        {trigger.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-400">
                        {/* Schedule badge */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium border border-blue-100">
                          <span className="material-symbols-outlined text-[11px]">schedule</span>
                          {formatSchedule(trigger)}
                        </span>

                        <span>·</span>
                        <span>
                          {filterCount((trigger.filters ?? {}) as TriggerFilters)} {tr.filters}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {(trigger.notificationChannels ?? []).includes("in_app") && (
                            <span className="material-symbols-outlined text-xs">
                              notifications
                            </span>
                          )}
                          {(trigger.notificationChannels ?? []).includes("email") && (
                            <span className="material-symbols-outlined text-xs">
                              mail
                            </span>
                          )}
                        </span>

                        {/* Next run */}
                        {trigger.isActive && nextRun && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <span className="material-symbols-outlined text-xs">update</span>
                              {tr.nextRun}: {nextRun}
                            </span>
                          </>
                        )}

                        {/* Last run */}
                        {trigger.lastRunAt && (
                          <>
                            <span>·</span>
                            <span>
                              {tr.lastRun}{" "}
                              {new Date(trigger.lastRunAt).toLocaleDateString(
                                locale === "da" ? "da-DK" : "en-US",
                                {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() =>
                        setExpandedId(expandedId === trigger.id ? null : trigger.id)
                      }
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer"
                      title={tr.showResults}
                    >
                      <span className={`material-symbols-outlined text-lg transition-transform duration-300 ${expandedId === trigger.id ? "rotate-180" : ""}`}>
                        expand_more
                      </span>
                    </button>
                    <button
                      onClick={() => handleRun(trigger.id)}
                      disabled={runningId === trigger.id}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-40 cursor-pointer"
                      title={tr.runNow}
                    >
                      <span
                        className={`material-symbols-outlined text-lg ${
                          runningId === trigger.id ? "animate-spin" : ""
                        }`}
                      >
                        {runningId === trigger.id
                          ? "progress_activity"
                          : "play_arrow"}
                      </span>
                    </button>
                    <button
                      onClick={() => openEdit(trigger)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">
                        edit
                      </span>
                    </button>
                    <button
                      onClick={() => handleDelete(trigger.id)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">
                        delete
                      </span>
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === trigger.id && (
                  <div className="px-4 sm:px-6 pb-5 border-t border-slate-100 pt-4 space-y-4 animate-slide-down">
                    {/* Schedule info */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
                        {tr.schedule}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          {formatSchedule(trigger)}
                        </span>
                        {trigger.cronExpression && (
                          <span className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-mono">
                            {trigger.cronExpression}
                          </span>
                        )}
                        {trigger.isActive && nextRun && (
                          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">update</span>
                            {tr.nextRun}: {nextRun}
                          </span>
                        )}
                        {!trigger.isActive && (
                          <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium">
                            {tr.paused}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Filters */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
                        {tr.filtersLabel}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(trigger.filters as TriggerFilters)?.industry_code && (
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            {tr.industryCode}: {(trigger.filters as TriggerFilters).industry_code}
                          </span>
                        )}
                        {(trigger.filters as TriggerFilters)?.city && (
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            {tr.city}: {(trigger.filters as TriggerFilters).city}
                          </span>
                        )}
                        {(trigger.filters as TriggerFilters)?.region && (
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            {tr.region}: {(trigger.filters as TriggerFilters).region}
                          </span>
                        )}
                        {(trigger.filters as TriggerFilters)?.company_type && (
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            {tr.companyType}: {(trigger.filters as TriggerFilters).company_type}
                          </span>
                        )}
                        {(trigger.filters as TriggerFilters)?.min_employees !== undefined && (
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            {tr.minEmployees}: {(trigger.filters as TriggerFilters).min_employees}
                          </span>
                        )}
                        {(trigger.filters as TriggerFilters)?.max_employees !== undefined && (
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            {tr.maxEmployees}: {(trigger.filters as TriggerFilters).max_employees}
                          </span>
                        )}
                        {(trigger.filters as TriggerFilters)?.founded_after && (
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            {tr.foundedAfter}: {(trigger.filters as TriggerFilters).founded_after}
                          </span>
                        )}
                        {filterCount((trigger.filters ?? {}) as TriggerFilters) === 0 && (
                          <span className="text-xs text-slate-400">
                            {tr.all} {tr.allDenmark}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Latest results */}
                    {latestResult && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
                          {tr.showResults} — {latestResult.matchCount} {tr.runResults}
                        </p>
                        {latestResult.companies && latestResult.companies.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {latestResult.companies.slice(0, 10).map((c: { vat: number; name: string; city: string; industry: string }) => (
                              <a
                                key={c.vat}
                                href={`/company/${c.vat}`}
                                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition-colors"
                              >
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-bold text-blue-600">
                                    {c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    {c.city}{c.industry ? ` · ${c.industry}` : ""}
                                  </p>
                                </div>
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">{tr.noTriggers}</p>
                        )}
                        {latestResult.matchCount > 10 && (
                          <p className="text-xs text-slate-400 mt-2">
                            +{latestResult.matchCount - 10} more
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay"
            onClick={() => setDialogOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col animate-modal">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-lg font-extrabold text-slate-900 font-[family-name:var(--font-manrope)]">
                {editing ? tr.editTrigger : tr.createTrigger}
              </h2>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  {tr.name}
                </label>
                <input
                  className="w-full bg-slate-50 border-none rounded-lg py-2.5 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tr.namePlaceholder}
                />
              </div>

              {/* Schedule section */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  {tr.schedule}
                </label>

                {/* Frequency + Day of week */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 px-1">{tr.frequency}</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                      className="w-full bg-slate-50 border-none rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer"
                    >
                      <option value="daily">{tr.dailyTime}</option>
                      <option value="weekly">{tr.weeklyTime}</option>
                    </select>
                  </div>

                  {frequency === "weekly" && (
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 px-1">{tr.dayOfWeek}</label>
                      <select
                        value={scheduledDayOfWeek}
                        onChange={(e) => setScheduledDayOfWeek(Number(e.target.value))}
                        className="w-full bg-slate-50 border-none rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer"
                      >
                        {DAY_KEYS.map((key, idx) => (
                          <option key={idx} value={idx}>
                            {tr[key as keyof typeof tr]}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Time picker */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 px-1">{tr.timeOfDay}</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={scheduledHour}
                      onChange={(e) => setScheduledHour(Number(e.target.value))}
                      className="bg-slate-50 border-none rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer tabular-nums"
                    >
                      {hours.map((h) => (
                        <option key={h} value={h}>{pad2(h)}</option>
                      ))}
                    </select>
                    <span className="text-slate-400 font-bold">:</span>
                    <select
                      value={scheduledMinute}
                      onChange={(e) => setScheduledMinute(Number(e.target.value))}
                      className="bg-slate-50 border-none rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer tabular-nums"
                    >
                      {minutes.map((m) => (
                        <option key={m} value={m}>{pad2(m)}</option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-400 ml-2">(Europe/Copenhagen)</span>
                  </div>
                </div>

                {/* Preview badge */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50/50 border border-blue-100">
                  <span className="material-symbols-outlined text-blue-500 text-lg">schedule</span>
                  <div className="text-sm">
                    <span className="font-medium text-blue-700">
                      {frequency === "weekly"
                        ? `${tr.everyWeekOn} ${tr[DAY_KEYS[scheduledDayOfWeek] as keyof typeof tr]} ${tr.at} ${pad2(scheduledHour)}:${pad2(scheduledMinute)}`
                        : `${tr.everyDayAt} ${pad2(scheduledHour)}:${pad2(scheduledMinute)}`}
                    </span>
                    <span className="text-blue-400 ml-2 font-mono text-xs">
                      {frequency === "weekly"
                        ? `${scheduledMinute} ${scheduledHour} * * ${scheduledDayOfWeek}`
                        : `${scheduledMinute} ${scheduledHour} * * *`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notification channels */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  {tr.notifications}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      {
                        value: "in_app" as NotificationChannel,
                        icon: "notifications",
                        label: tr.inApp,
                        desc: tr.inAppDesc,
                      },
                      {
                        value: "email" as NotificationChannel,
                        icon: "mail",
                        label: tr.emailLabel,
                        desc: tr.emailDesc,
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleChannel(opt.value)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        channels.includes(opt.value)
                          ? "border-blue-300 bg-blue-50/50 shadow-sm"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={channels.includes(opt.value)}
                        readOnly
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 pointer-events-none"
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="material-symbols-outlined text-slate-500 text-lg">
                          {opt.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {opt.label}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {opt.desc}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  {tr.filtersLabel}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 px-1">
                      {tr.industryCode}
                    </label>
                    <select
                      value={filters.industry_code || ""}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          industry_code: e.target.value || undefined,
                        })
                      }
                      className="w-full bg-slate-50 border-none rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="">{tr.selectIndustry}</option>
                      {t.search.industries
                        .filter((i) => i.code !== "all")
                        .map((ind) => (
                          <option key={ind.code} value={ind.code}>
                            {ind.label}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 px-1">
                      {tr.city}
                    </label>
                    <input
                      className="w-full bg-slate-50 border-none rounded-lg py-2.5 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={filters.city || ""}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          city: e.target.value || undefined,
                        })
                      }
                      placeholder={tr.cityPlaceholder}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 px-1">
                      {tr.region}
                    </label>
                    <select
                      value={filters.region || ""}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          region: e.target.value || undefined,
                        })
                      }
                      className="w-full bg-slate-50 border-none rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="">{tr.selectRegion}</option>
                      {t.search.regions
                        .filter((r) => r.code !== "all")
                        .map((reg) => (
                          <option key={reg.code} value={reg.code}>
                            {reg.label}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 px-1">
                      {tr.companyType}
                    </label>
                    <select
                      value={filters.company_type || ""}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          company_type: e.target.value || undefined,
                        })
                      }
                      className="w-full bg-slate-50 border-none rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="">{tr.select}</option>
                      <option value="ApS">ApS</option>
                      <option value="A/S">A/S</option>
                      <option value="I/S">I/S</option>
                      <option value="K/S">K/S</option>
                      <option value="Enkeltmandsvirksomhed">
                        Enkeltmandsvirksomhed
                      </option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 px-1">
                      {tr.minEmployees}
                    </label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border-none rounded-lg py-2.5 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={filters.min_employees ?? ""}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          min_employees: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 px-1">
                      {tr.maxEmployees}
                    </label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border-none rounded-lg py-2.5 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={filters.max_employees ?? ""}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          max_employees: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                      placeholder="1000"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 px-1">
                    {tr.foundedAfter}
                  </label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 border-none rounded-lg py-2.5 px-3 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={filters.founded_after ?? ""}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        founded_after: e.target.value || undefined,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2 sm:justify-end shrink-0">
              <button
                onClick={() => setDialogOpen(false)}
                className="px-5 py-2.5 border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {tr.cancel}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-full hover:scale-[1.02] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving
                  ? tr.saving
                  : editing
                    ? tr.update
                    : tr.create}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
