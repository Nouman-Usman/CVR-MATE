"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  PieChart, Pie, Tooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Users, UserPlus, CreditCard, Zap, RefreshCw, type LucideProps,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

// ── Palette (matches app globals.css) ──────────────────────────────────────────
const P = {
  blue: "#2563eb",
  cyan: "#06b6d4",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  green: "#10b981",
  red: "#ef4444",
  text: "#191c1e",
  muted: "#64748b",
  border: "#e2e8f0",
  bg: "#f7f9fb",
};

const PLAN_COLOR: Record<string, string> = {
  free: "#94a3b8",
  starter: P.blue,
  professional: P.violet,
  enterprise: P.green,
};

const STATUS_COLOR: Record<string, string> = {
  active: P.green,
  past_due: P.amber,
  canceled: P.red,
  unpaid: P.red,
  incomplete: "#94a3b8",
};

const FEATURE_COLORS = [P.blue, P.cyan, P.violet, P.green, P.amber, "#f97316", "#ec4899", "#14b8a6"];

const FEATURE_LABEL: Record<string, string> = {
  ai_usage: "AI Usage",
  company_search: "Company Search",
  export: "Exports",
  enrichment: "Enrichment",
  email_draft: "Email Draft",
  linkedin_draft: "LinkedIn Draft",
  phone_draft: "Phone Draft",
  ai_task_suggest: "AI Tasks",
  bulk_push: "Bulk Push",
};

const ENTITY_ICON: Record<string, string> = {
  company: "🏢", todo: "✅", note: "📝", trigger: "⚡", crm_sync: "🔗",
};

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Custom chart tooltip ────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-[#191c1e] mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm inline-block" style={{ background: p.color }} />
          <span className="text-[#64748b]">{p.name}:</span>
          <span className="font-bold text-[#191c1e]">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accent, loading,
}: {
  label: string; value: number; sub?: string;
  icon: React.FC<LucideProps>; accent: string; loading?: boolean;
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
        {loading ? (
          <Skeleton className="h-8 w-24 mb-1" />
        ) : (
          <p className="text-3xl font-bold text-[#191c1e] leading-none">{value.toLocaleString()}</p>
        )}
        {sub && <p className="text-xs text-[#64748b] mt-1.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Plan badge ─────────────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: string | null }) {
  const p = plan ?? "free";
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize border"
      style={{
        color: PLAN_COLOR[p] ?? P.muted,
        background: `${PLAN_COLOR[p] ?? P.muted}15`,
        borderColor: `${PLAN_COLOR[p] ?? P.muted}40`,
      }}
    >
      {p}
    </span>
  );
}

// ── Main data types ─────────────────────────────────────────────────────────────
interface OverviewData {
  generatedAt: string;
  kpis: { totalUsers: number; newToday: number; paidSubscriptions: number; activeTriggers: number };
  planDistribution: { plan: string; total: number }[];
  statusDistribution: { status: string; total: number }[];
  recentUsers: { id: string; name: string; email: string; emailVerified: boolean; createdAt: string; plan: string | null }[];
  recentActivity: { id: string; entityType: string; action: string; createdAt: string }[];
  featureUsage: { feature: string; total: number }[];
  userTrend: { day: string; label: string; users: number }[];
  subTrend: { day: string; label: string; subscriptions: number }[];
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
export function AdminOverviewDashboard() {
  const { data, isLoading, refetch, isFetching } = useQuery<OverviewData>({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/overview");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 55_000,
    refetchInterval: 60_000,
  });

  const totalSubs = data?.planDistribution.reduce((s, p) => s + Number(p.total), 0) ?? 0;
  const donutData = (data?.planDistribution ?? []).map((p) => ({
    name: p.plan, value: Number(p.total), fill: PLAN_COLOR[p.plan] ?? P.muted,
  }));
  const maxFeature = Math.max(...(data?.featureUsage ?? []).map((f) => Number(f.total)), 1);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#191c1e]">Platform Overview</h1>
          <p className="text-sm text-[#64748b] mt-1">Real-time platform health · auto-refreshes every 60 s</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2 text-[#64748b] border-[#e2e8f0]"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          {data ? `Updated ${timeAgo(data.generatedAt)}` : "Refresh"}
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Users" value={Number(data?.kpis.totalUsers ?? 0)} icon={Users} accent={P.blue} loading={isLoading} />
        <KpiCard label="New Today" value={Number(data?.kpis.newToday ?? 0)} icon={UserPlus} accent={P.green} sub="Since midnight UTC" loading={isLoading} />
        <KpiCard label="Paid Subscriptions" value={Number(data?.kpis.paidSubscriptions ?? 0)} icon={CreditCard} accent={P.violet} sub="Active non-free" loading={isLoading} />
        <KpiCard label="Active Triggers" value={Number(data?.kpis.activeTriggers ?? 0)} icon={Zap} accent={P.amber} sub="Platform-wide" loading={isLoading} />
      </div>

      {/* ── Charts row 1: Trend + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2 border-[#e2e8f0] shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-semibold text-[#191c1e]">User Registrations</CardTitle>
            <p className="text-xs text-[#64748b]">Last 7 days</p>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data?.userTrend ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="ugrd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={P.blue} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={P.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: P.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: P.muted }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="users" name="Users" stroke={P.blue} strokeWidth={2} fill="url(#ugrd)" dot={{ fill: P.blue, r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: P.blue }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-[#e2e8f0] shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-semibold text-[#191c1e]">Plan Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={3} dataKey="value">
                  {donutData.map((e, i) => <Cell key={i} fill={e.fill} stroke="transparent" />)}
                </Pie>
                <Tooltip content={<ChartTip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
              {donutData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.fill }} />
                  <span className="text-[11px] text-[#64748b] capitalize">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts row 2: Sub trend + Feature bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="border-[#e2e8f0] shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-semibold text-[#191c1e]">Subscription Growth</CardTitle>
            <p className="text-xs text-[#64748b]">Last 30 days</p>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={(data?.subTrend ?? []).filter((_, i) => i % 3 === 0)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sgrd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={P.green} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={P.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: P.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: P.muted }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="subscriptions" name="Subs" stroke={P.green} strokeWidth={2} fill="url(#sgrd)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-[#e2e8f0] shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-semibold text-[#191c1e]">Feature Usage</CardTitle>
            <p className="text-xs text-[#64748b]">This calendar month</p>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {(data?.featureUsage.length ?? 0) === 0 ? (
              <div className="h-[170px] flex items-center justify-center text-sm text-[#64748b]">No usage data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={170}>
                <BarChart
                  data={(data?.featureUsage ?? []).slice(0, 7).map((f) => ({ name: FEATURE_LABEL[f.feature] ?? f.feature, value: Number(f.total) }))}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: P.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: P.muted }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="value" name="Events" radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {(data?.featureUsage ?? []).slice(0, 7).map((_, i) => (
                      <Cell key={i} fill={FEATURE_COLORS[i % FEATURE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Status + Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="border-[#e2e8f0] shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-semibold text-[#191c1e]">Subscription Status</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {(data?.statusDistribution.length ?? 0) === 0 ? (
              <p className="text-sm text-[#64748b]">No subscriptions yet</p>
            ) : (
              data!.statusDistribution.map((s) => {
                const pct = totalSubs > 0 ? Math.round((Number(s.total) / totalSubs) * 100) : 0;
                const color = STATUS_COLOR[s.status] ?? P.muted;
                return (
                  <div key={s.status}>
                    <div className="flex justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-xs text-[#191c1e] capitalize">{s.status.replace("_", " ")}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color }}>{Number(s.total)}</span>
                    </div>
                    <div className="h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-[#e2e8f0] shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-semibold text-[#191c1e]">Recent Activity</CardTitle>
            <p className="text-xs text-[#64748b]">Last 20 events</p>
          </CardHeader>
          <CardContent className="px-5 pb-3 max-h-[220px] overflow-y-auto">
            {(data?.recentActivity.length ?? 0) === 0 ? (
              <p className="text-sm text-[#64748b]">No activity yet</p>
            ) : (
              data!.recentActivity.map((a, i) => (
                <div key={a.id} className={`flex items-center gap-3 py-2.5 ${i < data!.recentActivity.length - 1 ? "border-b border-[#f1f5f9]" : ""}`}>
                  <span className="text-base w-5 text-center shrink-0">{ENTITY_ICON[a.entityType] ?? "📌"}</span>
                  <p className="flex-1 text-xs text-[#64748b]">
                    <span className="capitalize">{a.entityType}</span>
                    {" "}
                    <span className="font-semibold text-[#2563eb]">{a.action}</span>
                  </p>
                  <span className="text-[10px] text-[#94a3b8] shrink-0">{timeAgo(a.createdAt)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent registrations ── */}
      <Card className="border-[#e2e8f0] shadow-sm mb-4">
        <CardHeader className="pb-2 pt-5 px-5 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-[#191c1e]">Recent Registrations</CardTitle>
            <p className="text-xs text-[#64748b] mt-0.5">Last 10 users</p>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <Table>
            <TableHeader>
              <TableRow className="border-[#f1f5f9]">
                <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b] font-semibold">User</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b] font-semibold">Email</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b] font-semibold">Verified</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b] font-semibold">Plan</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b] font-semibold">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-[#f1f5f9]">
                      {Array.from({ length: 5 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : (data?.recentUsers ?? []).map((u, i) => (
                    <TableRow key={u.id} className="border-[#f1f5f9] hover:bg-[#f8fafc]">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ background: FEATURE_COLORS[i % FEATURE_COLORS.length] }}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-[#191c1e]">{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-[#64748b] py-3">{u.email}</TableCell>
                      <TableCell className="py-3">
                        {u.emailVerified
                          ? <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Verified</Badge>
                          : <Badge variant="secondary" className="bg-[#f1f5f9] text-[#64748b] text-[10px]">Pending</Badge>}
                      </TableCell>
                      <TableCell className="py-3"><PlanBadge plan={u.plan} /></TableCell>
                      <TableCell className="text-xs text-[#64748b] py-3 whitespace-nowrap">{timeAgo(u.createdAt)}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Feature usage breakdown ── */}
      {(data?.featureUsage.length ?? 0) > 0 && (
        <Card className="border-[#e2e8f0] shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-semibold text-[#191c1e]">Feature Usage Breakdown</CardTitle>
            <p className="text-xs text-[#64748b]">
              {data!.featureUsage.reduce((s, f) => s + Number(f.total), 0).toLocaleString()} total events this month
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {data!.featureUsage.map((f, i) => {
              const cnt = Number(f.total);
              const pct = Math.round((cnt / maxFeature) * 100);
              const color = FEATURE_COLORS[i % FEATURE_COLORS.length];
              return (
                <div key={f.feature}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs text-[#64748b]">{FEATURE_LABEL[f.feature] ?? f.feature}</span>
                    <span className="text-xs font-bold" style={{ color }}>{cnt.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <p className="text-center text-[10px] text-[#94a3b8] mt-6">
        CVR-MATE Admin · Cached 60 s · {data ? new Date(data.generatedAt).toLocaleTimeString() : "—"}
      </p>
    </div>
  );
}
