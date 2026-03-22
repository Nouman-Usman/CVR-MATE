"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";

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

interface Trigger {
  id: string;
  name: string;
  filters: TriggerFilters;
  frequency: string;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
  notification_channels: NotificationChannel[];
}

const emptyFilters: TriggerFilters = {};

// Mock triggers
const mockTriggers: Trigger[] = [
  {
    id: "1",
    name: "Nye IT-virksomheder i København",
    filters: { industry_code: "62", city: "København", min_employees: 5 },
    frequency: "daily",
    is_active: true,
    last_run_at: "2026-03-22T08:00:00Z",
    created_at: "2026-03-01T10:00:00Z",
    notification_channels: ["in_app", "email"],
  },
  {
    id: "2",
    name: "Byggefirmaer i Midtjylland",
    filters: { industry_code: "41", region: "midtjylland" },
    frequency: "weekly",
    is_active: true,
    last_run_at: "2026-03-18T08:00:00Z",
    created_at: "2026-02-15T14:00:00Z",
    notification_channels: ["in_app"],
  },
  {
    id: "3",
    name: "Nye sundhedsvirksomheder",
    filters: { industry_code: "86", founded_after: "2026-01-01" },
    frequency: "daily",
    is_active: false,
    last_run_at: null,
    created_at: "2026-03-10T09:00:00Z",
    notification_channels: ["email"],
  },
];

export default function TriggersPage() {
  const { t, locale } = useLanguage();
  const tr = t.triggers;

  const [triggers, setTriggers] = useState<Trigger[]>(mockTriggers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Trigger | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [filters, setFilters] = useState<TriggerFilters>(emptyFilters);
  const [channels, setChannels] = useState<NotificationChannel[]>(["in_app"]);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setFrequency("daily");
    setFilters(emptyFilters);
    setChannels(["in_app"]);
    setDialogOpen(true);
  };

  const openEdit = (trigger: Trigger) => {
    setEditing(trigger);
    setName(trigger.name);
    setFrequency(trigger.frequency);
    setFilters(trigger.filters);
    setChannels(trigger.notification_channels);
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
    setSaving(true);

    setTimeout(() => {
      if (editing) {
        setTriggers((prev) =>
          prev.map((t) =>
            t.id === editing.id
              ? { ...t, name, frequency, filters, notification_channels: channels }
              : t
          )
        );
      } else {
        setTriggers((prev) => [
          {
            id: Date.now().toString(),
            name,
            frequency,
            filters,
            is_active: true,
            last_run_at: null,
            created_at: new Date().toISOString(),
            notification_channels: channels,
          },
          ...prev,
        ]);
      }
      setSaving(false);
      setDialogOpen(false);
    }, 500);
  };

  const handleToggle = (id: string) => {
    setTriggers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_active: !t.is_active } : t))
    );
  };

  const handleDelete = (id: string) => {
    setTriggers((prev) => prev.filter((t) => t.id !== id));
  };

  const handleRun = (id: string) => {
    setRunningId(id);
    setTimeout(() => {
      setTriggers((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, last_run_at: new Date().toISOString() } : t
        )
      );
      setRunningId(null);
    }, 1500);
  };

  const filterCount = (f: TriggerFilters) =>
    Object.values(f).filter((v) => v !== undefined && v !== "").length;

  return (
    <DashboardLayout>
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
          className="self-start flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-full hover:scale-[1.02] transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          {tr.newTrigger}
        </button>
      </div>

      {/* Empty state */}
      {triggers.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-20 text-center">
          <span className="material-symbols-outlined text-6xl text-slate-200 mb-4 block">
            bolt
          </span>
          <p className="text-slate-400 font-medium mb-6">{tr.noTriggers}</p>
          <button
            onClick={openCreate}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-full hover:scale-[1.02] transition-all"
          >
            {tr.createFirst}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {triggers.map((trigger) => (
            <div
              key={trigger.id}
              className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 overflow-hidden"
            >
              {/* Trigger row */}
              <div className="p-4 sm:p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(trigger.id)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
                      trigger.is_active ? "bg-blue-600" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        trigger.is_active ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-slate-900 truncate">
                      {trigger.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-400">
                      <span>
                        {trigger.frequency === "daily" ? tr.daily : tr.weekly}
                      </span>
                      <span>·</span>
                      <span>
                        {filterCount(trigger.filters)} {tr.filters}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        {trigger.notification_channels.includes("in_app") && (
                          <span className="material-symbols-outlined text-xs">
                            notifications
                          </span>
                        )}
                        {trigger.notification_channels.includes("email") && (
                          <span className="material-symbols-outlined text-xs">
                            mail
                          </span>
                        )}
                      </span>
                      {trigger.last_run_at && (
                        <>
                          <span>·</span>
                          <span>
                            {tr.lastRun}{" "}
                            {new Date(trigger.last_run_at).toLocaleDateString(
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
                    <span className="material-symbols-outlined text-lg">
                      {expandedId === trigger.id
                        ? "expand_less"
                        : "expand_more"}
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

              {/* Expanded results preview */}
              {expandedId === trigger.id && (
                <div className="px-4 sm:px-6 pb-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
                    {tr.filtersLabel}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {trigger.filters.industry_code && (
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {tr.industryCode}: {trigger.filters.industry_code}
                      </span>
                    )}
                    {trigger.filters.city && (
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {tr.city}: {trigger.filters.city}
                      </span>
                    )}
                    {trigger.filters.region && (
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {tr.region}: {trigger.filters.region}
                      </span>
                    )}
                    {trigger.filters.company_type && (
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {tr.companyType}: {trigger.filters.company_type}
                      </span>
                    )}
                    {trigger.filters.min_employees !== undefined && (
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {tr.minEmployees}: {trigger.filters.min_employees}
                      </span>
                    )}
                    {trigger.filters.max_employees !== undefined && (
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {tr.maxEmployees}: {trigger.filters.max_employees}
                      </span>
                    )}
                    {trigger.filters.founded_after && (
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {tr.foundedAfter}: {trigger.filters.founded_after}
                      </span>
                    )}
                    {filterCount(trigger.filters) === 0 && (
                      <span className="text-xs text-slate-400">
                        {tr.noTriggers}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setDialogOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-lg font-extrabold text-slate-900 font-[family-name:var(--font-manrope)]">
                {editing ? tr.editTrigger : tr.createTrigger}
              </h2>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Name + Frequency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    {tr.frequency}
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="daily">{tr.dailyTime}</option>
                    <option value="weekly">{tr.weeklyTime}</option>
                  </select>
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
                className="px-5 py-2.5 border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {tr.cancel}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-full hover:scale-[1.02] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
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
