"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity, Zap, PauseCircle, AlertTriangle, PlayCircle, Target, Unlock,
  Loader2, RefreshCw, CheckCircle2, type LucideProps,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface HealthData {
  generatedAt: string;
  triggers: { active: number; paused: number; overdue: number; runs24h: number; runs7d: number; matches7d: number };
  overdueTriggers: { id: string; name: string; email: string; frequency: string; nextRunAt: string | null; lastRunAt: string | null }[];
  cursors: { feedType: string; isProcessing: boolean; processingStartedAt: string | null; processedAt: string; lastChangeId: string; stale: boolean }[];
  staleLocks: number;
}

function fmtTime(d?: string | null) {
  return d ? new Date(d).toLocaleString("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}
function overdueBy(d: string | null) {
  if (!d) return "—";
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins}m late`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h late`;
  return `${Math.floor(h / 24)}d late`;
}

function Kpi({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.FC<LucideProps>; accent: string }) {
  return (
    <Card className="border-[#e2e8f0] shadow-sm" style={{ borderTopWidth: 3, borderTopColor: accent }}>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex justify-between items-start mb-3">
          <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">{label}</span>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}15` }}>
            <Icon size={16} color={accent} />
          </div>
        </div>
        <p className="text-2xl font-bold text-[#191c1e] leading-none tabular-nums">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

export function AdminHealthDashboard() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<HealthData>({
    queryKey: ["admin-health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/health");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const act = async (busyKey: string, payload: Record<string, unknown>) => {
    setBusy(busyKey);
    try {
      const res = await fetch("/api/admin/health/actions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed");
      toast.success(body.message || "Done");
      qc.invalidateQueries({ queryKey: ["admin-health"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const t = data?.triggers;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#191c1e] flex items-center gap-2">
            <Activity size={22} className="text-amber-600" /> Operational Health
          </h1>
          <p className="text-sm text-[#64748b] mt-1">Trigger jobs &amp; change-feed cron</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 text-[#64748b] border-[#e2e8f0]">
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {isError && (
        <Card className="border-rose-200 bg-rose-50 shadow-sm mb-6">
          <CardContent className="py-4 px-5 text-sm text-rose-700 font-medium">Couldn&apos;t load health data.
            <button className="underline ml-1" onClick={() => refetch()}>Retry</button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading || !t ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : (
          <>
            <Kpi label="Active Triggers" value={t.active} icon={Zap} accent="#2563eb" />
            <Kpi label="Paused" value={t.paused} icon={PauseCircle} accent="#94a3b8" />
            <Kpi label="Overdue" value={t.overdue} icon={AlertTriangle} accent={t.overdue > 0 ? "#ef4444" : "#94a3b8"} />
            <Kpi label="Stale Locks" value={data!.staleLocks} icon={Unlock} accent={data!.staleLocks > 0 ? "#ef4444" : "#94a3b8"} />
            <Kpi label="Runs · 24h" value={t.runs24h} icon={PlayCircle} accent="#06b6d4" />
            <Kpi label="Runs · 7d" value={t.runs7d} icon={PlayCircle} accent="#8b5cf6" />
            <Kpi label="Matches · 7d" value={t.matches7d} icon={Target} accent="#10b981" />
          </>
        )}
      </div>

      {/* Overdue triggers */}
      <Card className="border-[#e2e8f0] shadow-sm mb-6">
        <CardHeader className="pb-2 pt-5 px-5"><CardTitle className="text-sm font-semibold text-[#191c1e]">Overdue triggers</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#f1f5f9]">
                {["Trigger", "Owner", "Freq", "Was due", "Last run", ""].map((h, i) => (
                  <TableHead key={i} className={cn("text-[10px] uppercase tracking-wider text-[#64748b] font-semibold px-5", i === 5 && "text-right")}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="px-5 py-6"><Skeleton className="h-4 w-40" /></TableCell></TableRow>
              ) : (data?.overdueTriggers.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-emerald-600"><CheckCircle2 size={14} className="inline mr-1" /> All triggers on schedule</TableCell></TableRow>
              ) : (
                data!.overdueTriggers.map((tr) => (
                  <TableRow key={tr.id} className="border-[#f1f5f9]">
                    <TableCell className="px-5 py-3 text-sm font-medium text-[#191c1e]">{tr.name}</TableCell>
                    <TableCell className="px-5 py-3 text-xs text-[#64748b]">{tr.email}</TableCell>
                    <TableCell className="px-5 py-3 text-xs capitalize">{tr.frequency}</TableCell>
                    <TableCell className="px-5 py-3"><span className="text-xs font-bold text-rose-600">{overdueBy(tr.nextRunAt)}</span></TableCell>
                    <TableCell className="px-5 py-3 text-xs text-[#64748b]">{fmtTime(tr.lastRunAt)}</TableCell>
                    <TableCell className="px-5 py-3 text-right">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-[#e2e8f0] gap-1"
                        disabled={busy === tr.id} onClick={() => act(tr.id, { action: "queue_trigger", triggerId: tr.id })}>
                        {busy === tr.id ? <Loader2 size={12} className="animate-spin" /> : <><PlayCircle size={12} /> Queue now</>}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Change-feed cursors */}
      <Card className="border-[#e2e8f0] shadow-sm">
        <CardHeader className="pb-2 pt-5 px-5"><CardTitle className="text-sm font-semibold text-[#191c1e]">Change-feed cursors</CardTitle></CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (data?.cursors.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-400 py-2">No change-feed cursors yet</p>
          ) : (
            data!.cursors.map((c) => (
              <div key={c.feedType} className={cn("flex items-center gap-3 rounded-xl border p-3", c.stale ? "border-rose-200 bg-rose-50/50" : "border-slate-100")}>
                <div className={cn("size-2.5 rounded-full shrink-0", c.stale ? "bg-rose-500" : c.isProcessing ? "bg-amber-400" : "bg-emerald-500")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#191c1e]">{c.feedType}</p>
                  <p className="text-[11px] text-[#64748b]">
                    {c.stale ? "Stale lock — stuck processing" : c.isProcessing ? "Processing…" : "Idle"} · last processed {fmtTime(c.processedAt)}
                  </p>
                </div>
                {(c.stale || c.isProcessing) && (
                  <Button size="sm" variant="outline" className="h-7 text-xs border-rose-200 text-rose-700 gap-1"
                    disabled={busy === `lock-${c.feedType}`} onClick={() => act(`lock-${c.feedType}`, { action: "clear_lock", feedType: c.feedType })}>
                    {busy === `lock-${c.feedType}` ? <Loader2 size={12} className="animate-spin" /> : <><Unlock size={12} /> Clear lock</>}
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
