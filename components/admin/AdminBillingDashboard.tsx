"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  INK, MUTE, NEG, PLAN_COLOR, SUBSTATUS_COLOR,
  ConsoleShell, StatusHeader, RefreshButton, Ledger, LedgerTier, StatCell,
  Panel, RankRow, Tag, ConsoleTable, rowClass, rowStyle, ActionButton,
  ErrorBar, EmptyLine, StripeLink, dkk, num, fmtDate,
} from "./console";

interface BillingData {
  generatedAt: string;
  summary: {
    mrr: number; arr: number; currency: string; paidCount: number; arpu: number;
    trialCount: number; conversionRate: number; pastDueCount: number; pendingChurnCount: number;
  };
  mrrByTier: { plan: string; mrr: number; count: number }[];
  statusDistribution: { status: string; total: number }[];
  trials: { userId: string; email: string; name: string; plan: string; trialEnd: string | null; daysLeft: number | null; stripeCustomerId: string | null }[];
  dunning: { userId: string; email: string; plan: string; status: string; currentPeriodEnd: string | null; stripeCustomerId: string | null }[];
  pendingChurn: { userId: string; email: string; plan: string; currentPeriodEnd: string | null; pendingPlanChange: string | null; stripeCustomerId: string | null }[];
}

/* Skeleton placeholder rows sized to a table's column count. */
function LoadingRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="border-b" style={rowStyle}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="py-3"><Skeleton className="h-4 w-16" /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function AdminBillingDashboard() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<BillingData>({
    queryKey: ["admin-billing"],
    queryFn: async () => {
      const res = await fetch("/api/admin/billing");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });

  const act = async (busyKey: string, action: string, userId: string, extra: Record<string, unknown> = {}) => {
    setBusy(busyKey);
    try {
      const res = await fetch("/api/admin/billing/actions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId, ...extra }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Action failed");
      toast.success(body.message || "Done");
      qc.invalidateQueries({ queryKey: ["admin-billing"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const s = data?.summary;
  const maxTier = Math.max(...(data?.mrrByTier ?? []).map((t) => t.mrr), 1);

  return (
    <ConsoleShell>
      <StatusHeader tone="neutral" eyebrow={`billing · ${s?.currency ?? "dkk"}`} title="Billing & revenue">
        <RefreshButton onClick={() => refetch()} isFetching={isFetching} generatedAt={data?.generatedAt} />
      </StatusHeader>

      {isError && <ErrorBar message="couldn't load billing data." onRetry={() => refetch()} />}

      {/* Revenue readout ledger */}
      {isLoading || !s ? (
        <Skeleton className="mb-6 h-56 w-full rounded-xl" />
      ) : (
        <Ledger caption="revenue readout">
          <LedgerTier>
            <StatCell big label="MRR" value={dkk(s.mrr)} sub="normalized / mo" />
            <StatCell big label="ARR" value={dkk(s.arr)} sub="mrr × 12" />
            <StatCell big label="ARPU" value={dkk(s.arpu)} sub="per paid account" />
            <StatCell big label="Paid subs" value={num(s.paidCount)} sub="active, non-free" />
          </LedgerTier>
          <LedgerTier top>
            <StatCell label="Active trials" value={num(s.trialCount)} sub="on trial" />
            <StatCell label="Trial → paid" value={`${Math.round(s.conversionRate * 100)}%`} sub="of all trialed" />
            <StatCell danger={s.pastDueCount > 0} label="Past due" value={num(s.pastDueCount)} sub="dunning queue" />
            <StatCell label="Pending churn" value={num(s.pendingChurnCount)} sub="cancel at period end" />
          </LedgerTier>
        </Ledger>
      )}

      {/* MRR by tier */}
      <Panel title="MRR by tier" className="mb-6">
        {isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : (data?.mrrByTier.length ?? 0) === 0 ? (
          <EmptyLine>no active paid tiers.</EmptyLine>
        ) : (
          <div className="space-y-3">
            {(data?.mrrByTier ?? []).map((t) => (
              <RankRow key={t.plan} label={t.plan} value={t.mrr} max={maxTier} color={PLAN_COLOR[t.plan] ?? MUTE} trailing={`${t.count}`} />
            ))}
          </div>
        )}
      </Panel>

      {/* Active trials */}
      <Panel title="Active trials" className="mb-6">
        <ConsoleTable head={["user", "plan", "days left", "ends", ""]}>
          {isLoading ? (
            <LoadingRows cols={5} />
          ) : (data?.trials.length ?? 0) === 0 ? (
            <tr><td colSpan={5} className="py-10 text-center"><EmptyLine>no active trials.</EmptyLine></td></tr>
          ) : (
            data!.trials.map((t) => (
              <tr key={t.userId} className={rowClass} style={rowStyle}>
                <td className="py-2.5 font-mono text-[12px] text-slate-500">{t.email}</td>
                <td className="py-2.5"><Tag color={PLAN_COLOR[t.plan] ?? MUTE}>{t.plan}</Tag></td>
                <td className="py-2.5 font-mono text-[11px] font-bold tabular-nums" style={{ color: (t.daysLeft ?? 99) <= 3 ? NEG : INK }}>
                  {t.daysLeft != null ? `${t.daysLeft}d` : "—"}
                </td>
                <td className="py-2.5 font-mono text-[11px] tabular-nums text-slate-400">{fmtDate(t.trialEnd)}</td>
                <td className="py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <StripeLink id={t.stripeCustomerId} />
                    <ActionButton onClick={() => act(`trial-${t.userId}`, "extend_trial", t.userId, { days: 7 })} busy={busy === `trial-${t.userId}`}>+7 days</ActionButton>
                  </div>
                </td>
              </tr>
            ))
          )}
        </ConsoleTable>
      </Panel>

      {/* Dunning */}
      <Panel title="Dunning queue · past due / unpaid" className="mb-6">
        <ConsoleTable head={["user", "plan", "status", "period end", ""]}>
          {isLoading ? (
            <LoadingRows cols={5} />
          ) : (data?.dunning.length ?? 0) === 0 ? (
            <tr><td colSpan={5} className="py-10 text-center"><EmptyLine>nothing past due.</EmptyLine></td></tr>
          ) : (
            data!.dunning.map((d) => (
              <tr key={d.userId} className={rowClass} style={rowStyle}>
                <td className="py-2.5 font-mono text-[12px] text-slate-500">{d.email}</td>
                <td className="py-2.5"><Tag color={PLAN_COLOR[d.plan] ?? MUTE}>{d.plan}</Tag></td>
                <td className="py-2.5"><Tag color={SUBSTATUS_COLOR[d.status] ?? NEG}>{d.status.replace("_", " ")}</Tag></td>
                <td className="py-2.5 font-mono text-[11px] tabular-nums text-slate-400">{fmtDate(d.currentPeriodEnd)}</td>
                <td className="py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <StripeLink id={d.stripeCustomerId} />
                    <ActionButton onClick={() => act(`cancel-${d.userId}`, "cancel_subscription", d.userId)} busy={busy === `cancel-${d.userId}`} tone="danger">cancel</ActionButton>
                  </div>
                </td>
              </tr>
            ))
          )}
        </ConsoleTable>
      </Panel>

      {/* Pending churn */}
      <Panel title="Pending churn · cancel at period end" className="mb-6">
        <ConsoleTable head={["user", "plan", "ends", ""]}>
          {isLoading ? (
            <LoadingRows cols={4} />
          ) : (data?.pendingChurn.length ?? 0) === 0 ? (
            <tr><td colSpan={4} className="py-10 text-center"><EmptyLine>no pending cancellations.</EmptyLine></td></tr>
          ) : (
            data!.pendingChurn.map((c) => (
              <tr key={c.userId} className={rowClass} style={rowStyle}>
                <td className="py-2.5 font-mono text-[12px] text-slate-500">{c.email}</td>
                <td className="py-2.5"><Tag color={PLAN_COLOR[c.plan] ?? MUTE}>{c.plan}</Tag></td>
                <td className="py-2.5 font-mono text-[11px] tabular-nums text-slate-400">{fmtDate(c.currentPeriodEnd)}</td>
                <td className="py-2.5 text-right"><StripeLink id={c.stripeCustomerId} /></td>
              </tr>
            ))
          )}
        </ConsoleTable>
      </Panel>
    </ConsoleShell>
  );
}
