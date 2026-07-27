"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlayCircle, Unlock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  INK, HAIR, POS, WARN, NEG,
  ConsoleShell, StatusHeader, RefreshButton, Ledger, LedgerTier, StatCell,
  Panel, ConsoleTable, ActionButton, ErrorBar, EmptyLine,
  rowClass, rowStyle, num, fmtTime,
} from "./console";

interface HealthData {
  generatedAt: string;
  triggers: { active: number; paused: number; overdue: number; runs24h: number; runs7d: number; matches7d: number };
  overdueTriggers: { id: string; name: string; email: string; frequency: string; nextRunAt: string | null; lastRunAt: string | null }[];
  cursors: { feedType: string; isProcessing: boolean; processingStartedAt: string | null; processedAt: string; lastChangeId: string; stale: boolean }[];
  staleLocks: number;
}

function overdueBy(d: string | null) {
  if (!d) return "—";
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins}m late`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h late`;
  return `${Math.floor(h / 24)}d late`;
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
  const overdueCount = data?.triggers.overdue ?? 0;
  const staleCount = data?.staleLocks ?? 0;
  const needAttention = overdueCount + staleCount;
  const attention = overdueCount > 0 || staleCount > 0;

  return (
    <ConsoleShell>
      <StatusHeader
        tone={attention ? "warn" : "ok"}
        eyebrow={attention ? `${needAttention} need attention` : "all jobs on schedule"}
        title="Operational health"
      >
        <RefreshButton onClick={() => refetch()} isFetching={isFetching} generatedAt={data?.generatedAt} />
      </StatusHeader>

      {isError && <ErrorBar message="couldn't load health data." onRetry={() => refetch()} />}

      {/* ── VITALS LEDGER — job readout ── */}
      {isLoading || !t ? (
        <Skeleton className="mb-6 h-56 w-full rounded-xl" />
      ) : (
        <Ledger caption="job readout">
          <LedgerTier cols={4}>
            <StatCell label="Active triggers" value={num(t.active)} sub="scheduled & enabled" />
            <StatCell label="Paused" value={num(t.paused)} sub="disabled by owner" />
            <StatCell danger={t.overdue > 0} label="Overdue" value={num(t.overdue)} sub="past due window" />
            <StatCell danger={data!.staleLocks > 0} label="Stale locks" value={num(data!.staleLocks)} sub="stuck cursors" />
          </LedgerTier>
          <LedgerTier cols={4} top>
            <StatCell label="Runs · 24h" value={num(t.runs24h)} sub="trigger executions" />
            <StatCell label="Runs · 7d" value={num(t.runs7d)} sub="trigger executions" />
            <StatCell label="Matches · 7d" value={num(t.matches7d)} sub="companies surfaced" />
          </LedgerTier>
        </Ledger>
      )}

      {/* ── Overdue triggers ── */}
      <Panel title="Overdue triggers" className="mb-6">
        <ConsoleTable head={["trigger", "owner", "freq", "was due", "last run", ""]}>
          {isLoading ? (
            <tr><td colSpan={6} className="py-6"><Skeleton className="h-4 w-40" /></td></tr>
          ) : (data?.overdueTriggers.length ?? 0) === 0 ? (
            <tr><td colSpan={6} className="py-8 text-center"><EmptyLine>all triggers on schedule — nothing overdue.</EmptyLine></td></tr>
          ) : (
            data!.overdueTriggers.map((tr) => (
              <tr key={tr.id} className={rowClass} style={rowStyle}>
                <td className="py-2.5 font-mono text-[12px] font-semibold" style={{ color: INK }}>{tr.name}</td>
                <td className="py-2.5 font-mono text-[11px] text-slate-500">{tr.email}</td>
                <td className="py-2.5 font-mono text-[11px] capitalize text-slate-500">{tr.frequency}</td>
                <td className="py-2.5 font-mono text-[11px] font-bold" style={{ color: NEG }}>{overdueBy(tr.nextRunAt)}</td>
                <td className="py-2.5 font-mono text-[11px] tabular-nums text-slate-400">{fmtTime(tr.lastRunAt)}</td>
                <td className="py-2.5 text-right">
                  <ActionButton busy={busy === tr.id} onClick={() => act(tr.id, { action: "queue_trigger", triggerId: tr.id })}>
                    <PlayCircle size={12} /> queue now
                  </ActionButton>
                </td>
              </tr>
            ))
          )}
        </ConsoleTable>
      </Panel>

      {/* ── Change-feed cursors ── */}
      <Panel title="Change-feed cursors">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (data?.cursors.length ?? 0) === 0 ? (
          <EmptyLine>no change-feed cursors yet.</EmptyLine>
        ) : (
          <div>
            {data!.cursors.map((c, i) => {
              const dot = c.stale ? NEG : c.isProcessing ? WARN : POS;
              const state = c.stale ? "stale lock — stuck processing" : c.isProcessing ? "processing…" : "idle";
              return (
                <div key={c.feedType}
                  className={cn("flex items-center gap-3 py-3", i < data!.cursors.length - 1 && "border-b")}
                  style={{ borderColor: HAIR }}>
                  <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[12px] font-bold" style={{ color: INK }}>{c.feedType}</p>
                    <p className="font-mono text-[11px] text-slate-500">{state} · last processed {fmtTime(c.processedAt)}</p>
                  </div>
                  {(c.stale || c.isProcessing) && (
                    <ActionButton tone="danger" busy={busy === `lock-${c.feedType}`}
                      onClick={() => act(`lock-${c.feedType}`, { action: "clear_lock", feedType: c.feedType })}>
                      <Unlock size={12} /> clear lock
                    </ActionButton>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </ConsoleShell>
  );
}
