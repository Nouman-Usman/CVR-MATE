"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { RefreshCw, Pause, Play, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* ── Console palette (light register readout) ────────────────────────────── */
const INK = "#0B1220";
const HAIR = "#E3E9F2";
const MUTE = "#64748B";
const POS = "#059669";
const WARN = "#B45309";
const NEG = "#E11D48";
const CYAN = "#0891B2";

const PLAN_COLOR: Record<string, string> = {
  free: "#94A3B8", starter: "#2563EB", professional: "#7C3AED", enterprise: "#0891B2",
};
const STATUS_COLOR: Record<string, string> = {
  active: POS, trialing: CYAN, past_due: WARN, canceled: NEG, unpaid: NEG, incomplete: "#94A3B8",
};
const FEATURE_LABEL: Record<string, string> = {
  ai_usage: "ai_usage", company_search: "company_search", export: "export",
  enrichment: "enrichment", email_draft: "email_draft", linkedin_draft: "linkedin_draft",
  phone_draft: "phone_draft", ai_task_suggest: "ai_task_suggest", bulk_push: "bulk_push",
};
const RANGES = ["7d", "30d", "90d"] as const;
const nf = new Intl.NumberFormat("da-DK");

function ago(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/* ── Types (unchanged data contract) ─────────────────────────────────────── */
interface Kpi { value: number; deltaPct?: number | null; deltaLabel?: string; currency?: string }
interface OverviewData {
  generatedAt: string;
  range: string;
  kpis: {
    totalUsers: Kpi; newToday: Kpi; dau: Kpi; mrr: Kpi;
    paidSubscriptions: Kpi; trials: Kpi; activeTriggers: Kpi; syncErrors24h: Kpi;
  };
  alerts: { level: "warn" | "danger"; label: string; href?: string }[];
  planDistribution: { plan: string; total: number }[];
  statusDistribution: { status: string; total: number }[];
  recentUsers: { id: string; name: string; email: string; emailVerified: boolean; createdAt: string; plan: string | null }[];
  recentActivity: { id: string; entityType: string; action: string; createdAt: string }[];
  featureUsage: { feature: string; total: number }[];
  userTrend: { day: string; label: string; users: number }[];
  subTrend: { day: string; label: string; subscriptions: number }[];
}

/* ── Ledger cell — the signature ─────────────────────────────────────────── */
function Cell({
  label, value, delta, sub, href, big, danger,
}: {
  label: string; value: string; delta?: number | null; sub?: string;
  href?: string; big?: boolean; danger?: boolean;
}) {
  const body = (
    <div className="group h-full bg-white px-5 py-4 transition-colors hover:bg-slate-50/80">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</span>
        {href && <ArrowUpRight size={12} className="text-slate-300 transition-colors group-hover:text-slate-500" />}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={cn("font-black tabular-nums leading-none", big ? "text-[2rem]" : "text-2xl")}
          style={{ color: danger && value !== "0" ? NEG : INK }}
        >
          {value}
        </span>
        {typeof delta === "number" && (
          <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: delta > 0 ? POS : delta < 0 ? NEG : MUTE }}>
            {delta > 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>
      <p className="mt-1.5 font-mono text-[10px] text-slate-400">{sub ?? " "}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/* ── Register-style breakdown: label · hairline bar · mono count ──────────── */
function RankRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate font-mono text-[11px] text-slate-600">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.max((value / max) * 100, 2)}%`, background: color }} />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums" style={{ color: INK }}>{nf.format(value)}</span>
    </div>
  );
}

function Panel({ title, meta, children, className }: { title: string; meta?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-white", className)} style={{ borderColor: HAIR }}>
      <header className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: HAIR }}>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-600">{title}</h2>
        {meta && <span className="font-mono text-[10px] text-slate-400">{meta}</span>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function TrendTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-white px-2.5 py-1.5 font-mono text-[10px] shadow-sm" style={{ borderColor: HAIR }}>
      <span className="text-slate-400">{label}</span>{" "}
      <span className="font-bold" style={{ color: INK }}>{payload[0].value}</span>
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────────────────────────────── */
export function AdminOverviewDashboard() {
  const router = useRouter();
  const [range, setRange] = useState<string>("30d");
  const [live, setLive] = useState(true);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<OverviewData>({
    queryKey: ["admin-overview", range],
    queryFn: async () => {
      const res = await fetch(`/api/admin/overview?range=${range}`);
      if (!res.ok) throw new Error("Failed to load overview");
      return res.json();
    },
    staleTime: 55_000,
    refetchInterval: live ? 60_000 : false,
  });

  const k = data?.kpis;
  const money = (v?: number) => `kr ${nf.format(v ?? 0)}`;
  const num = (v?: number) => nf.format(v ?? 0);
  const alerts = data?.alerts ?? [];
  const ok = alerts.length === 0;

  const planTotal = (data?.planDistribution ?? []).reduce((s, p) => s + Number(p.total), 0) || 1;
  const statusTotal = (data?.statusDistribution ?? []).reduce((s, p) => s + Number(p.total), 0) || 1;
  const featMax = Math.max(...(data?.featureUsage ?? []).map((f) => Number(f.total)), 1);

  return (
    <div className="min-h-full px-8 py-7" style={{ background: "#F6F8FC" }}>
      <div className="mx-auto max-w-[1360px]">

        {/* ── Status line — the thesis ── */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-5" style={{ borderColor: HAIR }}>
          <div className="flex items-center gap-3.5">
            <span className="relative mt-1 flex size-2 shrink-0">
              {live && ok && <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ background: POS }} />}
              <span className="relative inline-flex size-2 rounded-full" style={{ background: ok ? POS : WARN }} />
            </span>
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: ok ? POS : WARN }}>
                {ok ? "System nominal" : `${alerts.length} alert${alerts.length > 1 ? "s" : ""}`}
              </p>
              <h1 className="mt-0.5 text-xl font-black tracking-tight" style={{ color: INK }}>Platform overview</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border bg-white p-0.5" style={{ borderColor: HAIR }}>
              {RANGES.map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={cn("rounded-md px-2.5 py-1 font-mono text-[11px] font-bold transition-colors", range === r ? "text-white" : "text-slate-500 hover:text-slate-800")}
                  style={range === r ? { background: INK } : undefined}>
                  {r}
                </button>
              ))}
            </div>
            <button onClick={() => setLive((v) => !v)} title={live ? "Live · 60s" : "Paused"}
              className="flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 font-mono text-[11px] font-bold text-slate-600 transition-colors hover:text-slate-900" style={{ borderColor: HAIR }}>
              {live ? <Pause size={12} /> : <Play size={12} />}{live ? "live" : "paused"}
            </button>
            <button onClick={() => refetch()} disabled={isFetching}
              className="flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-500 transition-colors hover:text-slate-900" style={{ borderColor: HAIR }}>
              <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
              {data ? `synced ${ago(data.generatedAt)} ago` : "sync"}
            </button>
          </div>
        </div>

        {/* ── Alert / error strip ── */}
        {isError ? (
          <div className="mb-6 flex items-center justify-between rounded-xl border px-5 py-3.5" style={{ borderColor: "#FBD5DE", background: "#FEF2F4" }}>
            <p className="font-mono text-[12px]" style={{ color: NEG }}>metrics feed unreachable — the console couldn&apos;t read platform data.</p>
            <button onClick={() => refetch()} className="font-mono text-[11px] font-bold underline" style={{ color: NEG }}>retry</button>
          </div>
        ) : alerts.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {alerts.map((a, i) => {
              const danger = a.level === "danger";
              const chip = (
                <span className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-bold"
                  style={danger ? { color: NEG, borderColor: "#FBD5DE", background: "#FEF2F4" } : { color: WARN, borderColor: "#FCE7C3", background: "#FFF9EE" }}>
                  <span className="size-1.5 rounded-full" style={{ background: danger ? NEG : WARN }} />
                  {a.label}
                  {a.href && <ArrowUpRight size={11} className="opacity-60" />}
                </span>
              );
              return a.href ? <Link key={i} href={a.href}>{chip}</Link> : <span key={i}>{chip}</span>;
            })}
          </div>
        )}

        {/* ── VITALS LEDGER — signature ── */}
        {isLoading ? (
          <Skeleton className="mb-6 h-56 w-full rounded-xl" />
        ) : (
          <div className="mb-6 overflow-hidden rounded-xl border" style={{ borderColor: HAIR }}>
            <div className="flex items-center gap-2 border-b bg-slate-50/60 px-5 py-2" style={{ borderColor: HAIR }}>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Vitals</span>
              <span className="font-mono text-[10px] text-slate-400">· live register readout</span>
            </div>
            {/* primary tier */}
            <div className="grid grid-cols-2 gap-px sm:grid-cols-4" style={{ background: HAIR }}>
              <Cell big label="MRR" value={money(k?.mrr.value)} sub="normalized / mo" href="/admin/billing" />
              <Cell big label="Total users" value={num(k?.totalUsers.value)} delta={k?.totalUsers.deltaPct} sub="signups vs last week" href="/admin/users" />
              <Cell big label="Paid subs" value={num(k?.paidSubscriptions.value)} delta={k?.paidSubscriptions.deltaPct} sub="active, non-free" href="/admin/billing" />
              <Cell big label="Active trials" value={num(k?.trials.value)} sub="on 14-day trial" href="/admin/billing" />
            </div>
            {/* secondary tier */}
            <div className="grid grid-cols-2 gap-px border-t sm:grid-cols-4" style={{ background: HAIR, borderColor: HAIR }}>
              <Cell label="Active today" value={num(k?.dau.value)} sub="distinct sessions" href="/admin/users" />
              <Cell label="New today" value={num(k?.newToday.value)} sub="since 00:00 UTC" href="/admin/users" />
              <Cell label="Active triggers" value={num(k?.activeTriggers.value)} sub="platform-wide" href="/admin/health" />
              <Cell danger label="Sync errors · 24h" value={num(k?.syncErrors24h.value)} sub="CRM push failures" href="/admin/integrations" />
            </div>
          </div>
        )}

        {/* ── Registrations trend + breakdowns ── */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Registrations" meta={`last ${range}`} className="lg:col-span-2">
            {isLoading ? <Skeleton className="h-[200px] w-full" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data?.userTrend ?? []} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={INK} stopOpacity={0.08} />
                      <stop offset="100%" stopColor={INK} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTE, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} minTickGap={28} />
                  <YAxis tick={{ fontSize: 10, fill: MUTE, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                  <Tooltip content={<TrendTip />} cursor={{ stroke: HAIR }} />
                  <Area type="monotone" dataKey="users" stroke={INK} strokeWidth={1.5} fill="url(#reg)" dot={false} activeDot={{ r: 3, fill: INK }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="Plan split" meta={`${planTotal} subs`}>
            {isLoading ? <Skeleton className="h-[200px] w-full" /> : (
              <>
                <div className="mb-4 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  {(data?.planDistribution ?? []).map((p) => (
                    <div key={p.plan} style={{ width: `${(Number(p.total) / planTotal) * 100}%`, background: PLAN_COLOR[p.plan] ?? MUTE }} />
                  ))}
                </div>
                <div className="space-y-2.5">
                  {(data?.planDistribution ?? []).map((p) => (
                    <div key={p.plan} className="flex items-center gap-2">
                      <span className="size-2 rounded-sm" style={{ background: PLAN_COLOR[p.plan] ?? MUTE }} />
                      <span className="flex-1 font-mono text-[11px] capitalize text-slate-600">{p.plan}</span>
                      <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: INK }}>{p.total}</span>
                      <span className="w-9 text-right font-mono text-[10px] text-slate-400">{Math.round((Number(p.total) / planTotal) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Panel>
        </div>

        {/* ── Usage + status + activity ── */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Feature usage" meta="this month">
            {isLoading ? <Skeleton className="h-40 w-full" /> : (data?.featureUsage.length ?? 0) === 0 ? (
              <p className="font-mono text-[11px] text-slate-400">no usage recorded yet — activity will appear as the platform is used.</p>
            ) : (
              <div className="space-y-2.5">
                {data!.featureUsage.slice(0, 8).map((f) => (
                  <RankRow key={f.feature} label={FEATURE_LABEL[f.feature] ?? f.feature} value={Number(f.total)} max={featMax} color={CYAN} />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Subscription status">
            {isLoading ? <Skeleton className="h-40 w-full" /> : (data?.statusDistribution.length ?? 0) === 0 ? (
              <p className="font-mono text-[11px] text-slate-400">no subscriptions yet.</p>
            ) : (
              <div className="space-y-2.5">
                {data!.statusDistribution.map((s) => (
                  <RankRow key={s.status} label={s.status.replace("_", " ")} value={Number(s.total)} max={statusTotal} color={STATUS_COLOR[s.status] ?? MUTE} />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Activity" meta="last 20">
            {isLoading ? <Skeleton className="h-40 w-full" /> : (data?.recentActivity.length ?? 0) === 0 ? (
              <p className="font-mono text-[11px] text-slate-400">no activity yet.</p>
            ) : (
              <div className="max-h-44 space-y-0 overflow-y-auto">
                {data!.recentActivity.map((a, i) => (
                  <div key={a.id} className={cn("flex items-center gap-2 py-2", i < data!.recentActivity.length - 1 && "border-b")} style={{ borderColor: HAIR }}>
                    <span className="font-mono text-[11px] text-slate-500">{a.entityType}</span>
                    <span className="font-mono text-[11px] font-bold" style={{ color: CYAN }}>{a.action}</span>
                    <span className="ml-auto font-mono text-[10px] tabular-nums text-slate-400">{ago(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* ── Recent registrations ── */}
        <Panel title="Recent registrations" meta="click a row to manage">
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: HAIR }}>
                    {["user", "email", "verified", "plan", "joined"].map((h) => (
                      <th key={h} className="pb-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentUsers ?? []).map((u) => (
                    <tr key={u.id} onClick={() => router.push(`/admin/users?focus=${u.id}`)}
                      className="cursor-pointer border-b transition-colors hover:bg-slate-50/70" style={{ borderColor: HAIR }}>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-7 items-center justify-center rounded-md font-mono text-[11px] font-bold text-white" style={{ background: INK }}>
                            {u.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-[13px] font-semibold" style={{ color: INK }}>{u.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 font-mono text-[12px] text-slate-500">{u.email}</td>
                      <td className="py-2.5">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wide" style={{ color: u.emailVerified ? POS : MUTE }}>
                          {u.emailVerified ? "verified" : "pending"}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className="font-mono text-[11px] capitalize" style={{ color: PLAN_COLOR[u.plan ?? "free"] ?? MUTE }}>{u.plan ?? "free"}</span>
                      </td>
                      <td className="py-2.5 font-mono text-[11px] tabular-nums text-slate-400">{ago(u.createdAt)} ago</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <p className="mt-6 text-center font-mono text-[10px] text-slate-400">
          cvr-mate admin · cached 60s · {data ? new Date(data.generatedAt).toLocaleTimeString("en-GB") : "—"}
        </p>
      </div>
    </div>
  );
}
