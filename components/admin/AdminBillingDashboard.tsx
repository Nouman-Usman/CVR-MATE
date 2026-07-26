"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CreditCard, TrendingUp, Users, Rocket, AlertTriangle, ArrowDownRight,
  ExternalLink, Loader2, RefreshCw, type LucideProps,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PLAN_COLOR: Record<string, string> = {
  starter: "#2563eb", professional: "#8b5cf6", enterprise: "#10b981",
};
const dkk = (n: number) => new Intl.NumberFormat("da-DK").format(n);

// Stripe keys in this project are test-mode; link into the matching dashboard.
const STRIPE_TEST = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").includes("_test_");
const stripeCustomerUrl = (id: string | null) =>
  id ? `https://dashboard.stripe.com/${STRIPE_TEST ? "test/" : ""}customers/${id}` : null;

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

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function Kpi({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: React.FC<LucideProps>; accent: string;
}) {
  return (
    <Card className="border-[#e2e8f0] shadow-sm" style={{ borderTopWidth: 3, borderTopColor: accent }}>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex justify-between items-start mb-3">
          <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">{label}</span>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}15` }}>
            <Icon size={16} color={accent} />
          </div>
        </div>
        <p className="text-2xl font-bold text-[#191c1e] leading-none tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-[#94a3b8] mt-1.5">{sub}</p>}
      </CardContent>
    </Card>
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
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#191c1e] flex items-center gap-2">
            <CreditCard size={22} className="text-emerald-600" /> Billing &amp; Revenue
          </h1>
          <p className="text-sm text-[#64748b] mt-1">MRR derived from plans · trials · dunning</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 text-[#64748b] border-[#e2e8f0]">
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {isError && (
        <Card className="border-rose-200 bg-rose-50 shadow-sm mb-6">
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <AlertTriangle size={18} className="text-rose-500 shrink-0" />
            <p className="flex-1 text-sm text-rose-700 font-medium">Couldn&apos;t load billing data.</p>
            <Button size="sm" variant="outline" className="border-rose-200 text-rose-700" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading || !s ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
        ) : (
          <>
            <Kpi label="MRR" value={`kr ${dkk(s.mrr)}`} sub="Normalized monthly" icon={CreditCard} accent="#10b981" />
            <Kpi label="ARR" value={`kr ${dkk(s.arr)}`} sub="MRR × 12" icon={TrendingUp} accent="#2563eb" />
            <Kpi label="ARPU" value={`kr ${dkk(s.arpu)}`} sub="Per paid account" icon={Users} accent="#8b5cf6" />
            <Kpi label="Paid Subs" value={dkk(s.paidCount)} sub="Active, non-free" icon={CreditCard} accent="#06b6d4" />
            <Kpi label="Active Trials" value={dkk(s.trialCount)} icon={Rocket} accent="#06b6d4" />
            <Kpi label="Trial → Paid" value={`${Math.round(s.conversionRate * 100)}%`} sub="Of all trialed" icon={TrendingUp} accent="#10b981" />
            <Kpi label="Past Due" value={dkk(s.pastDueCount)} sub="Dunning queue" icon={AlertTriangle} accent={s.pastDueCount > 0 ? "#ef4444" : "#94a3b8"} />
            <Kpi label="Pending Churn" value={dkk(s.pendingChurnCount)} sub="Cancel at period end" icon={ArrowDownRight} accent={s.pendingChurnCount > 0 ? "#f59e0b" : "#94a3b8"} />
          </>
        )}
      </div>

      {/* MRR by tier */}
      <Card className="border-[#e2e8f0] shadow-sm mb-6">
        <CardHeader className="pb-2 pt-5 px-5"><CardTitle className="text-sm font-semibold text-[#191c1e]">MRR by tier</CardTitle></CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          {(data?.mrrByTier ?? []).map((t) => (
            <div key={t.plan}>
              <div className="flex justify-between mb-1.5 text-xs">
                <span className="capitalize font-medium text-[#191c1e]">{t.plan} <span className="text-slate-400">· {t.count}</span></span>
                <span className="font-bold tabular-nums" style={{ color: PLAN_COLOR[t.plan] }}>kr {dkk(t.mrr)}</span>
              </div>
              <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(t.mrr / maxTier) * 100}%`, background: PLAN_COLOR[t.plan] }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Trials */}
      <BillingTable
        title="Active trials" empty="No active trials"
        head={["User", "Plan", "Days left", "Ends", ""]}
        rows={(data?.trials ?? []).map((t) => (
          <TableRow key={t.userId} className="border-[#f1f5f9]">
            <TableCell className="px-5 py-3 text-sm text-[#191c1e]">{t.email}</TableCell>
            <TableCell className="px-5 py-3 capitalize text-xs">{t.plan}</TableCell>
            <TableCell className="px-5 py-3">
              <span className={cn("text-xs font-bold", (t.daysLeft ?? 99) <= 3 ? "text-rose-600" : "text-slate-600")}>
                {t.daysLeft != null ? `${t.daysLeft}d` : "—"}
              </span>
            </TableCell>
            <TableCell className="px-5 py-3 text-xs text-[#64748b]">{fmtDate(t.trialEnd)}</TableCell>
            <TableCell className="px-5 py-3 text-right">
              <div className="flex items-center justify-end gap-2">
                <StripeLink id={t.stripeCustomerId} />
                <Button size="sm" variant="outline" className="border-[#e2e8f0] h-7 text-xs"
                  disabled={busy === `trial-${t.userId}`}
                  onClick={() => act(`trial-${t.userId}`, "extend_trial", t.userId, { days: 7 })}>
                  {busy === `trial-${t.userId}` ? <Loader2 size={12} className="animate-spin" /> : "+7 days"}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        loading={isLoading}
      />

      {/* Dunning */}
      <BillingTable
        title="Dunning queue · past due / unpaid" empty="Nothing past due 🎉"
        head={["User", "Plan", "Status", "Period end", ""]}
        rows={(data?.dunning ?? []).map((d) => (
          <TableRow key={d.userId} className="border-[#f1f5f9]">
            <TableCell className="px-5 py-3 text-sm text-[#191c1e]">{d.email}</TableCell>
            <TableCell className="px-5 py-3 capitalize text-xs">{d.plan}</TableCell>
            <TableCell className="px-5 py-3">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 capitalize">{d.status.replace("_", " ")}</span>
            </TableCell>
            <TableCell className="px-5 py-3 text-xs text-[#64748b]">{fmtDate(d.currentPeriodEnd)}</TableCell>
            <TableCell className="px-5 py-3 text-right">
              <div className="flex items-center justify-end gap-2">
                <StripeLink id={d.stripeCustomerId} />
                <Button size="sm" variant="outline" className="border-rose-200 text-rose-700 h-7 text-xs"
                  disabled={busy === `cancel-${d.userId}`}
                  onClick={() => act(`cancel-${d.userId}`, "cancel_subscription", d.userId)}>
                  {busy === `cancel-${d.userId}` ? <Loader2 size={12} className="animate-spin" /> : "Cancel"}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        loading={isLoading}
      />

      {/* Pending churn */}
      <BillingTable
        title="Pending churn · cancel at period end" empty="No pending cancellations"
        head={["User", "Plan", "Ends", ""]}
        rows={(data?.pendingChurn ?? []).map((c) => (
          <TableRow key={c.userId} className="border-[#f1f5f9]">
            <TableCell className="px-5 py-3 text-sm text-[#191c1e]">{c.email}</TableCell>
            <TableCell className="px-5 py-3 capitalize text-xs">{c.plan}</TableCell>
            <TableCell className="px-5 py-3 text-xs text-[#64748b]">{fmtDate(c.currentPeriodEnd)}</TableCell>
            <TableCell className="px-5 py-3 text-right"><StripeLink id={c.stripeCustomerId} /></TableCell>
          </TableRow>
        ))}
        loading={isLoading}
      />
    </div>
  );
}

function StripeLink({ id }: { id: string | null }) {
  const url = stripeCustomerUrl(id);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
      Stripe <ExternalLink size={11} />
    </a>
  );
}

function BillingTable({ title, empty, head, rows, loading }: {
  title: string; empty: string; head: string[]; rows: React.ReactNode[]; loading: boolean;
}) {
  return (
    <Card className="border-[#e2e8f0] shadow-sm mb-6">
      <CardHeader className="pb-2 pt-5 px-5"><CardTitle className="text-sm font-semibold text-[#191c1e]">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-[#f1f5f9]">
              {head.map((h, i) => (
                <TableHead key={i} className={cn("text-[10px] uppercase tracking-wider text-[#64748b] font-semibold px-5", i === head.length - 1 && "text-right")}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={head.length} className="px-5 py-6"><Skeleton className="h-4 w-40" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={head.length} className="text-center py-8 text-sm text-slate-400">{empty}</TableCell></TableRow>
            ) : rows}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
