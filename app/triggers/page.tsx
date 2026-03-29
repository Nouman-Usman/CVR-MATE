"use client";

import { useState } from "react";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Zap,
  Plus,
  Play,
  Pencil,
  Trash2,
  ChevronDown,
  Clock,
  Bell,
  Mail,
  RefreshCw,
  Loader2,
  Calendar,
  MapPin,
  Building2,
  Users,
  Filter,
  ArrowRight,
  Pause,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

type NotificationChannel = "in_app" | "email";

interface TriggerFilters {
  industry_code?: string;
  branch_code?: string;
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

// ── Styled select wrapper ───────────────────────────────────────────

function FormSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:ring-2 focus:ring-ring/20 focus:border-ring outline-none appearance-none transition-colors cursor-pointer"
    >
      {children}
    </select>
  );
}

export default function TriggersPage() {
  const { t, locale } = useLanguage();
  const tr = t.triggers;

  const { data, isLoading } = useTriggers();
  const triggers = (data?.triggers ?? []) as Trigger[];

  const createMutation = useCreateTrigger();
  const updateMutation = useUpdateTrigger();
  const deleteMutation = useDeleteTrigger();
  const runMutation = useRunTrigger();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Trigger | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [filters, setFilters] = useState<TriggerFilters>(emptyFilters);
  const [channels, setChannels] = useState<NotificationChannel[]>(["in_app"]);
  const [scheduledHour, setScheduledHour] = useState(8);
  const [scheduledMinute, setScheduledMinute] = useState(0);
  const [scheduledDayOfWeek, setScheduledDayOfWeek] = useState(1);

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
      updateMutation.mutate({ id: editing.id, ...payload }, {
        onSuccess: () => { setDialogOpen(false); toast.success(tr.updated); },
        onError: () => toast.error(tr.runError),
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { setDialogOpen(false); toast.success(tr.created); },
        onError: () => toast.error(tr.runError),
      });
    }
  };

  const handleToggle = (trigger: Trigger) => {
    updateMutation.mutate({ id: trigger.id, isActive: !trigger.isActive });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm(tr.deleteConfirm)) return;
    deleteMutation.mutate(id, { onSuccess: () => toast.success(tr.deleted) });
  };

  const handleRun = (id: string) => {
    runMutation.mutate(id, {
      onSuccess: (data) => {
        const count = data?.result?.matchCount ?? 0;
        toast.success(`${tr.runSuccess} — ${count} ${tr.runResults}`);
      },
      onError: () => toast.error(tr.runError),
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
      weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
    if (diffH > 0 && diffH < 24) return `${dateStr} (${diffH}h)`;
    return dateStr;
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  const activeCount = triggers.filter(t => t.isActive).length;

  return (
    <DashboardLayout>
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)]">
            {tr.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">{tr.subtitle}</p>
        </div>
        <Button variant="gradient" size="lg" className="self-start rounded-xl gap-2" onClick={openCreate}>
          <Plus className="size-4" />
          {tr.newTrigger}
        </Button>
      </div>

      {/* ── Stats ────────────────────────────────────────────── */}
      {!isLoading && triggers.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Zap className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">{triggers.length}</p>
                <p className="text-[11px] text-muted-foreground font-medium">{locale === "da" ? "Triggers i alt" : "Total triggers"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">{activeCount}</p>
                <p className="text-[11px] text-muted-foreground font-medium">{locale === "da" ? "Aktive" : "Active"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Pause className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">{triggers.length - activeCount}</p>
                <p className="text-[11px] text-muted-foreground font-medium">{tr.paused}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────── */}
      {isLoading && (
        <Card className="border-0 shadow-sm py-0">
          <CardContent className="p-0 divide-y divide-border/30">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-5">
                <Skeleton className="w-11 h-6 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ──────────────────────────────────────── */}
      {!isLoading && triggers.length === 0 && (
        <Card className="py-20 border-0 shadow-sm">
          <CardContent className="text-center animate-fade-in-up">
            <div className="w-20 h-20 rounded-2xl bg-amber-500/5 flex items-center justify-center mx-auto mb-5">
              <Zap className="size-9 text-amber-500/40" />
            </div>
            <p className="text-foreground font-semibold text-lg mb-1.5">{locale === "da" ? "Ingen triggers endnu" : "No triggers yet"}</p>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">{tr.noTriggers}</p>
            <Button variant="gradient" size="lg" className="rounded-xl gap-2" onClick={openCreate}>
              <Plus className="size-4" />
              {tr.createFirst}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Trigger list ─────────────────────────────────────── */}
      {!isLoading && triggers.length > 0 && (
        <div className="space-y-3 animate-stagger">
          {triggers.map((trigger) => {
            const latestResult = getLatestResult(trigger);
            const nextRun = formatNextRun(trigger);
            const fCount = filterCount((trigger.filters ?? {}) as TriggerFilters);
            const isExpanded = expandedId === trigger.id;

            return (
              <Card key={trigger.id} className={cn(
                "border-0 shadow-sm overflow-hidden transition-all duration-300 py-0",
                isExpanded && "shadow-md"
              )}>
                {/* ── Main row ─────────────────────────────── */}
                <div className="p-4 sm:p-5 flex items-center gap-4">
                  {/* Toggle switch */}
                  <Switch
                    checked={trigger.isActive}
                    onCheckedChange={() => handleToggle(trigger)}
                    className="shrink-0"
                  />

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm text-foreground truncate">{trigger.name}</p>
                      {!trigger.isActive && (
                        <Badge variant="secondary" className="bg-amber-50 text-amber-600 border-0 text-[9px] font-bold uppercase h-5">
                          {tr.paused}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-600 gap-1 font-medium h-5.5 text-[10px]">
                        <Clock className="size-2.5" />
                        {formatSchedule(trigger)}
                      </Badge>
                      {fCount > 0 && (
                        <Badge variant="secondary" className="border-0 gap-1 font-medium h-5.5 text-[10px]">
                          <Filter className="size-2.5" />
                          {fCount} {tr.filters}
                        </Badge>
                      )}
                      <span className="flex items-center gap-1 text-muted-foreground/60">
                        {(trigger.notificationChannels ?? []).includes("in_app") && <Bell className="size-3" />}
                        {(trigger.notificationChannels ?? []).includes("email") && <Mail className="size-3" />}
                      </span>
                      {trigger.isActive && nextRun && (
                        <span className="hidden sm:flex items-center gap-1 text-emerald-600">
                          <RefreshCw className="size-2.5" />
                          {tr.nextRun}: {nextRun}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setExpandedId(isExpanded ? null : trigger.id)}
                      className="text-muted-foreground"
                    >
                      <ChevronDown className={cn("size-4 transition-transform duration-300", isExpanded && "rotate-180")} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRun(trigger.id)}
                      disabled={runningId === trigger.id}
                      className="text-muted-foreground hover:text-primary"
                      title={tr.runNow}
                    >
                      {runningId === trigger.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Play className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(trigger)}
                      className="text-muted-foreground"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(trigger.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {/* ── Expanded details ─────────────────────── */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-border/30 pt-4 space-y-5 animate-slide-down">
                    {/* Schedule section */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Clock className="size-3" />
                        {tr.schedule}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-700 gap-1.5 font-medium py-1.5 px-3 text-xs">
                          <Clock className="size-3" />
                          {formatSchedule(trigger)}
                        </Badge>
                        {trigger.cronExpression && (
                          <Badge variant="secondary" className="border-0 font-mono text-xs py-1.5 px-3">
                            {trigger.cronExpression}
                          </Badge>
                        )}
                        {trigger.isActive && nextRun && (
                          <Badge variant="secondary" className="border-0 bg-emerald-50 text-emerald-700 gap-1.5 font-medium py-1.5 px-3 text-xs">
                            <RefreshCw className="size-3" />
                            {tr.nextRun}: {nextRun}
                          </Badge>
                        )}
                        {!trigger.isActive && (
                          <Badge variant="secondary" className="border-0 bg-amber-50 text-amber-700 font-medium py-1.5 px-3 text-xs">
                            {tr.paused}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Filters section */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Filter className="size-3" />
                        {tr.filtersLabel}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(trigger.filters as TriggerFilters)?.industry_code && (
                          <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-700 font-medium text-xs">{tr.industryCode}: {(trigger.filters as TriggerFilters).industry_code}</Badge>
                        )}
                        {(trigger.filters as TriggerFilters)?.branch_code && (
                          <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-700 font-medium text-xs">{tr.branchCode}: {(trigger.filters as TriggerFilters).branch_code}</Badge>
                        )}
                        {(trigger.filters as TriggerFilters)?.city && (
                          <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-700 font-medium text-xs gap-1"><MapPin className="size-2.5" />{(trigger.filters as TriggerFilters).city}</Badge>
                        )}
                        {(trigger.filters as TriggerFilters)?.region && (
                          <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-700 font-medium text-xs">{tr.region}: {(trigger.filters as TriggerFilters).region}</Badge>
                        )}
                        {(trigger.filters as TriggerFilters)?.company_type && (
                          <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-700 font-medium text-xs">{(trigger.filters as TriggerFilters).company_type}</Badge>
                        )}
                        {(trigger.filters as TriggerFilters)?.min_employees !== undefined && (
                          <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-700 font-medium text-xs gap-1"><Users className="size-2.5" />{tr.minEmployees}: {(trigger.filters as TriggerFilters).min_employees}</Badge>
                        )}
                        {(trigger.filters as TriggerFilters)?.max_employees !== undefined && (
                          <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-700 font-medium text-xs gap-1"><Users className="size-2.5" />{tr.maxEmployees}: {(trigger.filters as TriggerFilters).max_employees}</Badge>
                        )}
                        {(trigger.filters as TriggerFilters)?.founded_after && (
                          <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-700 font-medium text-xs gap-1"><Calendar className="size-2.5" />{tr.foundedAfter}: {(trigger.filters as TriggerFilters).founded_after}</Badge>
                        )}
                        {fCount === 0 && (
                          <span className="text-xs text-muted-foreground">{tr.all} {tr.allDenmark}</span>
                        )}
                      </div>
                    </div>

                    {/* Latest results */}
                    {latestResult && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                          <Building2 className="size-3" />
                          {tr.showResults} — {latestResult.matchCount} {tr.runResults}
                        </p>
                        {latestResult.companies && latestResult.companies.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {latestResult.companies.slice(0, 10).map((c: { vat: number; name: string; city: string; industry: string }) => (
                              <Link
                                key={c.vat}
                                href={`/company/${c.vat}`}
                                className="group flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/20 hover:bg-accent/50 transition-all"
                              >
                                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm">
                                  <span className="text-[10px] font-bold text-blue-600">
                                    {c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{c.name}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {c.city}{c.industry ? ` · ${c.industry}` : ""}
                                  </p>
                                </div>
                                <ArrowRight className="size-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-all shrink-0" />
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">{tr.noTriggers}</p>
                        )}
                        {latestResult.matchCount > 10 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            +{latestResult.matchCount - 10} {locale === "da" ? "flere" : "more"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Dialog ──────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border/40 shrink-0">
            <DialogTitle className="font-[family-name:var(--font-manrope)]">
              {editing ? tr.editTrigger : tr.createTrigger}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tr.name}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr.namePlaceholder}
                className="bg-muted/30"
              />
            </div>

            {/* Schedule */}
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tr.schedule}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{tr.frequency}</Label>
                  <FormSelect value={frequency} onChange={setFrequency}>
                    <option value="daily">{tr.dailyTime}</option>
                    <option value="weekly">{tr.weeklyTime}</option>
                  </FormSelect>
                </div>
                {frequency === "weekly" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{tr.dayOfWeek}</Label>
                    <FormSelect value={String(scheduledDayOfWeek)} onChange={(v) => setScheduledDayOfWeek(Number(v))}>
                      {DAY_KEYS.map((key, idx) => (
                        <option key={idx} value={idx}>{tr[key as keyof typeof tr]}</option>
                      ))}
                    </FormSelect>
                  </div>
                )}
              </div>

              {/* Time picker */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{tr.timeOfDay}</Label>
                <div className="flex items-center gap-2">
                  <FormSelect value={String(scheduledHour)} onChange={(v) => setScheduledHour(Number(v))}>
                    {hours.map((h) => (<option key={h} value={h}>{pad2(h)}</option>))}
                  </FormSelect>
                  <span className="text-muted-foreground font-bold">:</span>
                  <FormSelect value={String(scheduledMinute)} onChange={(v) => setScheduledMinute(Number(v))}>
                    {minutes.map((m) => (<option key={m} value={m}>{pad2(m)}</option>))}
                  </FormSelect>
                  <span className="text-xs text-muted-foreground ml-1 shrink-0">(CET)</span>
                </div>
              </div>

              {/* Schedule preview */}
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-blue-50/50 border border-blue-100">
                <Clock className="size-4 text-blue-500 shrink-0" />
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
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tr.notifications}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  { value: "in_app" as NotificationChannel, icon: Bell, label: tr.inApp, desc: tr.inAppDesc },
                  { value: "email" as NotificationChannel, icon: Mail, label: tr.emailLabel, desc: tr.emailDesc },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleChannel(opt.value)}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                      channels.includes(opt.value)
                        ? "border-primary/30 bg-accent/50 shadow-sm"
                        : "border-border/40 hover:border-border"
                    )}
                  >
                    <Checkbox checked={channels.includes(opt.value)} className="pointer-events-none" />
                    <opt.icon className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tr.filtersLabel}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{tr.industryCode}</Label>
                  <FormSelect value={filters.industry_code || ""} onChange={(v) => setFilters({ ...filters, industry_code: v || undefined })}>
                    <option value="">{tr.selectIndustry}</option>
                    {t.search.industries.filter((i) => i.code !== "all").map((ind) => (
                      <option key={ind.code} value={ind.code}>{ind.label}</option>
                    ))}
                  </FormSelect>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{tr.branchCode}</Label>
                  <Input
                    className="bg-muted/30"
                    value={filters.branch_code || ""}
                    onChange={(e) => setFilters({ ...filters, branch_code: e.target.value.replace(/\D/g, "").slice(0, 6) || undefined })}
                    placeholder={tr.branchCodePlaceholder}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{tr.city}</Label>
                  <Input className="bg-muted/30" value={filters.city || ""} onChange={(e) => setFilters({ ...filters, city: e.target.value || undefined })} placeholder={tr.cityPlaceholder} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{tr.region}</Label>
                  <FormSelect value={filters.region || ""} onChange={(v) => setFilters({ ...filters, region: v || undefined })}>
                    <option value="">{tr.selectRegion}</option>
                    {t.search.regions.filter((r) => r.code !== "all").map((reg) => (
                      <option key={reg.code} value={reg.code}>{reg.label}</option>
                    ))}
                  </FormSelect>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{tr.companyType}</Label>
                  <FormSelect value={filters.company_type || ""} onChange={(v) => setFilters({ ...filters, company_type: v || undefined })}>
                    <option value="">{tr.select}</option>
                    <option value="ApS">ApS</option>
                    <option value="A/S">A/S</option>
                    <option value="I/S">I/S</option>
                    <option value="K/S">K/S</option>
                    <option value="Enkeltmandsvirksomhed">Enkeltmandsvirksomhed</option>
                  </FormSelect>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{tr.minEmployees}</Label>
                  <Input type="number" className="bg-muted/30" value={filters.min_employees ?? ""} onChange={(e) => setFilters({ ...filters, min_employees: e.target.value ? Number(e.target.value) : undefined })} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{tr.maxEmployees}</Label>
                  <Input type="number" className="bg-muted/30" value={filters.max_employees ?? ""} onChange={(e) => setFilters({ ...filters, max_employees: e.target.value ? Number(e.target.value) : undefined })} placeholder="1000" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{tr.foundedAfter}</Label>
                <Input type="date" className="bg-muted/30" value={filters.founded_after ?? ""} onChange={(e) => setFilters({ ...filters, founded_after: e.target.value || undefined })} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t border-border/40 gap-2 sm:gap-0 shrink-0">
            <DialogClose render={<Button variant="outline" className="rounded-xl" />}>
              {tr.cancel}
            </DialogClose>
            <Button
              variant="gradient"
              className="rounded-xl"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? tr.saving : editing ? tr.update : tr.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
