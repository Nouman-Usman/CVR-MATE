"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Mail, Send, CheckCircle2, XCircle, Eye, MousePointerClick, RefreshCw, AlertTriangle,
  type LucideProps,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface EmailData {
  generatedAt: string;
  summary: {
    dispatched: number; sent: number; failed: number; delivered: number; bounced: number; opened: number; clicked: number;
    bounceRate: number; deliveryRate: number; openRate: number; clickRate: number; failureRate: number;
  };
  byTemplate: { templateId: string; total: number; bounced: number; failed: number }[];
  failures: { id: string; to: string; subject: string; templateId: string | null; status: string; deliveryStatus: string | null; error: string | null; createdAt: string }[];
}

function fmtTime(d?: string | null) {
  return d ? new Date(d).toLocaleString("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}
const pctStr = (n: number) => `${(n * 100).toFixed(1)}%`;

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

export function AdminEmailDashboard() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<EmailData>({
    queryKey: ["admin-email"],
    queryFn: async () => {
      const res = await fetch("/api/admin/email");
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
            <Mail size={22} className="text-blue-600" /> Email Deliverability
          </h1>
          <p className="text-sm text-[#64748b] mt-1">Last 30 days · Resend + fallback providers</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 text-[#64748b] border-[#e2e8f0]">
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {isError && (
        <Card className="border-rose-200 bg-rose-50 shadow-sm mb-6">
          <CardContent className="py-4 px-5 text-sm text-rose-700 font-medium">Couldn&apos;t load email metrics.
            <button className="underline ml-1" onClick={() => refetch()}>Retry</button>
          </CardContent>
        </Card>
      )}

      {/* Funnel KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading || !s ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : (
          <>
            <Kpi label="Sent" value={s.sent.toLocaleString()} sub={`${s.dispatched.toLocaleString()} dispatched`} icon={Send} accent="#2563eb" />
            <Kpi label="Delivered" value={s.delivered.toLocaleString()} sub={pctStr(s.deliveryRate)} icon={CheckCircle2} accent="#10b981" />
            <Kpi label="Bounced" value={s.bounced.toLocaleString()} sub={pctStr(s.bounceRate)} icon={XCircle} accent={s.bounceRate > 0.05 ? "#ef4444" : "#94a3b8"} />
            <Kpi label="Failed" value={s.failed.toLocaleString()} sub={pctStr(s.failureRate)} icon={AlertTriangle} accent={s.failed > 0 ? "#f59e0b" : "#94a3b8"} />
            <Kpi label="Opened" value={s.opened.toLocaleString()} sub={pctStr(s.openRate)} icon={Eye} accent="#8b5cf6" />
            <Kpi label="Clicked" value={s.clicked.toLocaleString()} sub={pctStr(s.clickRate)} icon={MousePointerClick} accent="#06b6d4" />
            <Kpi label="Bounce rate" value={pctStr(s.bounceRate)} sub="delivered basis" icon={XCircle} accent={s.bounceRate > 0.05 ? "#ef4444" : "#94a3b8"} />
            <Kpi label="Open rate" value={pctStr(s.openRate)} sub="of sent" icon={Eye} accent="#8b5cf6" />
          </>
        )}
      </div>

      {/* By template */}
      <Card className="border-[#e2e8f0] shadow-sm mb-6">
        <CardHeader className="pb-2 pt-5 px-5"><CardTitle className="text-sm font-semibold text-[#191c1e]">By template</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#f1f5f9]">
                {["Template", "Sent", "Bounced", "Failed", "Bounce %"].map((h, i) => (
                  <TableHead key={i} className={cn("text-[10px] uppercase tracking-wider text-[#64748b] font-semibold px-5", i > 0 && "text-right")}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="px-5 py-6"><Skeleton className="h-4 w-40" /></TableCell></TableRow>
              ) : (data?.byTemplate.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-slate-400">No email sent in the last 30 days</TableCell></TableRow>
              ) : (
                data!.byTemplate.map((t) => {
                  const br = t.total > 0 ? t.bounced / t.total : 0;
                  return (
                    <TableRow key={t.templateId} className="border-[#f1f5f9]">
                      <TableCell className="px-5 py-3 text-sm font-medium text-[#191c1e] font-mono">{t.templateId}</TableCell>
                      <TableCell className="px-5 py-3 text-right text-xs tabular-nums">{t.total.toLocaleString()}</TableCell>
                      <TableCell className="px-5 py-3 text-right text-xs tabular-nums">{t.bounced.toLocaleString()}</TableCell>
                      <TableCell className="px-5 py-3 text-right text-xs tabular-nums">{t.failed.toLocaleString()}</TableCell>
                      <TableCell className={cn("px-5 py-3 text-right text-xs font-bold tabular-nums", br > 0.05 ? "text-rose-600" : "text-slate-500")}>{pctStr(br)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Failures */}
      <Card className="border-[#e2e8f0] shadow-sm">
        <CardHeader className="pb-2 pt-5 px-5"><CardTitle className="text-sm font-semibold text-[#191c1e]">Recent failures &amp; bounces</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#f1f5f9]">
                {["To", "Subject", "State", "Error", "When"].map((h) => (
                  <TableHead key={h} className="text-[10px] uppercase tracking-wider text-[#64748b] font-semibold px-5">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="px-5 py-6"><Skeleton className="h-4 w-40" /></TableCell></TableRow>
              ) : (data?.failures.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-emerald-600"><CheckCircle2 size={14} className="inline mr-1" /> No failures or bounces</TableCell></TableRow>
              ) : (
                data!.failures.map((f) => (
                  <TableRow key={f.id} className="border-[#f1f5f9]">
                    <TableCell className="px-5 py-3 text-xs text-[#191c1e]">{f.to}</TableCell>
                    <TableCell className="px-5 py-3 text-xs text-[#64748b] max-w-[180px] truncate">{f.subject}</TableCell>
                    <TableCell className="px-5 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">{f.deliveryStatus ?? f.status}</span>
                    </TableCell>
                    <TableCell className="px-5 py-3 text-[11px] text-rose-600 max-w-[200px] truncate">{f.error ?? "—"}</TableCell>
                    <TableCell className="px-5 py-3 text-xs text-[#64748b] whitespace-nowrap">{fmtTime(f.createdAt)}</TableCell>
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
