"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Plug, Link2, AlertTriangle, Clock, RefreshCw, CheckCircle2, type LucideProps,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PROVIDER_COLOR: Record<string, string> = {
  hubspot: "#ff7a59", leadconnector: "#2563eb", pipedrive: "#10b981",
};
const SYNC_COLOR: Record<string, string> = {
  synced: "#10b981", success: "#10b981", pending: "#f59e0b", error: "#ef4444", conflict: "#f97316", skipped: "#94a3b8",
};

interface IntegrationsData {
  generatedAt: string;
  summary: { activeConnections: number; totalSyncs7d: number; errorRate: number; expiringSoon: number };
  byProvider: { provider: string; total: number }[];
  syncStatus: { status: string; total: number }[];
  mappingBacklog: { syncStatus: string; total: number }[];
  connections: { provider: string; email: string; isActive: boolean; tokenExpiresAt: string | null; connectedAt: string; lastRefreshedAt: string | null; tokenExpiringSoon: boolean; tokenExpired: boolean }[];
  recentErrors: { id: string; action: string; status: string; errorMessage: string | null; createdAt: string }[];
}

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" }) : "—";
}
function fmtTime(d?: string | null) {
  return d ? new Date(d).toLocaleString("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

function Kpi({ label, value, sub, icon: Icon, accent }: { label: string; value: string; sub?: string; icon: React.FC<LucideProps>; accent: string }) {
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

export function AdminIntegrationsDashboard() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<IntegrationsData>({
    queryKey: ["admin-integrations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/integrations");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });

  const s = data?.summary;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#191c1e] flex items-center gap-2">
            <Plug size={22} className="text-violet-600" /> CRM Integrations
          </h1>
          <p className="text-sm text-[#64748b] mt-1">Connection &amp; sync health across providers</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 text-[#64748b] border-[#e2e8f0]">
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {isError && (
        <Card className="border-rose-200 bg-rose-50 shadow-sm mb-6">
          <CardContent className="py-4 px-5 text-sm text-rose-700 font-medium">Couldn&apos;t load integration data.
            <button className="underline ml-1" onClick={() => refetch()}>Retry</button>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading || !s ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : (
          <>
            <Kpi label="Active Connections" value={s.activeConnections.toLocaleString()} icon={Link2} accent="#2563eb" />
            <Kpi label="Syncs · 7d" value={s.totalSyncs7d.toLocaleString()} icon={RefreshCw} accent="#8b5cf6" />
            <Kpi label="Error rate · 7d" value={`${(s.errorRate * 100).toFixed(1)}%`} icon={AlertTriangle} accent={s.errorRate > 0.1 ? "#ef4444" : "#94a3b8"} />
            <Kpi label="Tokens expiring" value={s.expiringSoon.toLocaleString()} sub="within 3 days" icon={Clock} accent={s.expiringSoon > 0 ? "#f59e0b" : "#94a3b8"} />
          </>
        )}
      </div>

      {/* Provider + sync status + backlog chips */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="border-[#e2e8f0] shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5"><CardTitle className="text-sm font-semibold text-[#191c1e]">By provider</CardTitle></CardHeader>
          <CardContent className="px-5 pb-5 flex flex-wrap gap-2">
            {(data?.byProvider.length ?? 0) === 0 ? <p className="text-xs text-slate-400">None connected</p> :
              data!.byProvider.map((p) => (
                <span key={p.provider} className="text-xs rounded-lg px-3 py-1.5 capitalize font-medium"
                  style={{ background: `${PROVIDER_COLOR[p.provider] ?? "#94a3b8"}15`, color: PROVIDER_COLOR[p.provider] ?? "#64748b" }}>
                  {p.provider} <span className="font-bold">{p.total}</span>
                </span>
              ))}
          </CardContent>
        </Card>
        <Card className="border-[#e2e8f0] shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5"><CardTitle className="text-sm font-semibold text-[#191c1e]">Sync status · 7d</CardTitle></CardHeader>
          <CardContent className="px-5 pb-5 flex flex-wrap gap-2">
            {(data?.syncStatus.length ?? 0) === 0 ? <p className="text-xs text-slate-400">No syncs</p> :
              data!.syncStatus.map((s2) => (
                <span key={s2.status} className="text-xs rounded-lg px-3 py-1.5 capitalize font-medium"
                  style={{ background: `${SYNC_COLOR[s2.status] ?? "#94a3b8"}15`, color: SYNC_COLOR[s2.status] ?? "#64748b" }}>
                  {s2.status} <span className="font-bold">{s2.total}</span>
                </span>
              ))}
          </CardContent>
        </Card>
        <Card className="border-[#e2e8f0] shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5"><CardTitle className="text-sm font-semibold text-[#191c1e]">Mapping backlog</CardTitle></CardHeader>
          <CardContent className="px-5 pb-5 flex flex-wrap gap-2">
            {(data?.mappingBacklog.length ?? 0) === 0 ? <p className="text-xs text-slate-400">No mappings</p> :
              data!.mappingBacklog.map((m) => (
                <span key={m.syncStatus} className="text-xs rounded-lg px-3 py-1.5 capitalize font-medium"
                  style={{ background: `${SYNC_COLOR[m.syncStatus] ?? "#94a3b8"}15`, color: SYNC_COLOR[m.syncStatus] ?? "#64748b" }}>
                  {m.syncStatus} <span className="font-bold">{m.total}</span>
                </span>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* Connections */}
      <Card className="border-[#e2e8f0] shadow-sm mb-6">
        <CardHeader className="pb-2 pt-5 px-5"><CardTitle className="text-sm font-semibold text-[#191c1e]">Connections</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#f1f5f9]">
                {["Provider", "Owner", "Token expiry", "Connected", "Last refresh"].map((h) => (
                  <TableHead key={h} className="text-[10px] uppercase tracking-wider text-[#64748b] font-semibold px-5">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="px-5 py-6"><Skeleton className="h-4 w-40" /></TableCell></TableRow>
              ) : (data?.connections.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-slate-400">No CRM connections</TableCell></TableRow>
              ) : (
                data!.connections.map((c, i) => (
                  <TableRow key={i} className={cn("border-[#f1f5f9]", !c.isActive && "opacity-50")}>
                    <TableCell className="px-5 py-3">
                      <span className="text-xs font-bold capitalize" style={{ color: PROVIDER_COLOR[c.provider] ?? "#64748b" }}>{c.provider}</span>
                    </TableCell>
                    <TableCell className="px-5 py-3 text-xs text-[#191c1e]">{c.email}</TableCell>
                    <TableCell className="px-5 py-3">
                      {c.tokenExpired ? <span className="text-xs font-bold text-rose-600">Expired</span>
                        : c.tokenExpiringSoon ? <span className="text-xs font-bold text-amber-600">Soon · {fmtDate(c.tokenExpiresAt)}</span>
                        : <span className="text-xs text-[#64748b]">{fmtDate(c.tokenExpiresAt)}</span>}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-xs text-[#64748b]">{fmtDate(c.connectedAt)}</TableCell>
                    <TableCell className="px-5 py-3 text-xs text-[#64748b]">{fmtTime(c.lastRefreshedAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent errors */}
      <Card className="border-[#e2e8f0] shadow-sm">
        <CardHeader className="pb-2 pt-5 px-5"><CardTitle className="text-sm font-semibold text-[#191c1e]">Recent sync errors · 7d</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#f1f5f9]">
                {["Action", "Error", "When"].map((h) => (
                  <TableHead key={h} className="text-[10px] uppercase tracking-wider text-[#64748b] font-semibold px-5">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="px-5 py-6"><Skeleton className="h-4 w-40" /></TableCell></TableRow>
              ) : (data?.recentErrors.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-sm text-emerald-600"><CheckCircle2 size={14} className="inline mr-1" /> No sync errors this week</TableCell></TableRow>
              ) : (
                data!.recentErrors.map((e) => (
                  <TableRow key={e.id} className="border-[#f1f5f9]">
                    <TableCell className="px-5 py-3 text-xs font-mono text-[#191c1e]">{e.action}</TableCell>
                    <TableCell className="px-5 py-3 text-[11px] text-rose-600 max-w-[320px] truncate">{e.errorMessage ?? "—"}</TableCell>
                    <TableCell className="px-5 py-3 text-xs text-[#64748b] whitespace-nowrap">{fmtTime(e.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
