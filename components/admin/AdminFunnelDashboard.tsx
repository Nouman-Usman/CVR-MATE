"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Filter, MessageSquare, Mail, Phone, Building2, CheckCircle2, RotateCcw,
  Loader2, RefreshCw, Inbox,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Msg { role: string; content: string }
interface FunnelData {
  generatedAt: string;
  funnel: { sessions: number; signups: number; converted: number; signupRate: number; conversionRate: number };
  planDistribution: { plan: string | null; total: number }[];
  recentSessions: { id: string; createdAt: string; recommendedPlan: string | null; signupEmail: string | null; convertedAt: string | null; ipAddress: string | null; transcript: Msg[] }[];
  inquiries: { id: string; name: string; email: string; company: string; phone: string | null; message: string | null; createdAt: string; handledAt: string | null; handledBy: string | null }[];
  openInquiries: number;
}

function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

export function AdminFunnelDashboard() {
  const qc = useQueryClient();
  const [transcript, setTranscript] = useState<Msg[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<FunnelData>({
    queryKey: ["admin-funnel"],
    queryFn: async () => {
      const res = await fetch("/api/admin/funnel");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });

  const triage = async (id: string, handled: boolean) => {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/funnel/actions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: handled ? "mark_handled" : "mark_unhandled", id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success(handled ? "Marked handled" : "Reopened");
      qc.invalidateQueries({ queryKey: ["admin-funnel"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const f = data?.funnel;
  const stages = f
    ? [
        { label: "Sessions started", value: f.sessions, pct: 100 },
        { label: "Reached signup", value: f.signups, pct: f.sessions ? (f.signups / f.sessions) * 100 : 0 },
        { label: "Converted (trial)", value: f.converted, pct: f.sessions ? (f.converted / f.sessions) * 100 : 0 },
      ]
    : [];

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#191c1e] flex items-center gap-2">
            <Filter size={22} className="text-blue-600" /> Conversion Funnel
          </h1>
          <p className="text-sm text-[#64748b] mt-1">Chat-landing funnel &amp; enterprise inquiries</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 text-[#64748b] border-[#e2e8f0]">
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {isError && (
        <Card className="border-rose-200 bg-rose-50 shadow-sm mb-6">
          <CardContent className="py-4 px-5 text-sm text-rose-700 font-medium">Couldn&apos;t load funnel data.
            <button className="underline ml-1" onClick={() => refetch()}>Retry</button>
          </CardContent>
        </Card>
      )}

      {/* Funnel bars */}
      <Card className="border-[#e2e8f0] shadow-sm mb-6">
        <CardHeader className="pb-2 pt-5 px-5">
          <CardTitle className="text-sm font-semibold text-[#191c1e]">Chat-landing funnel</CardTitle>
          {f && <p className="text-xs text-[#64748b]">Signup {Math.round(f.signupRate * 100)}% · Conversion {Math.round(f.conversionRate * 100)}%</p>}
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          {isLoading || !f ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)
          ) : (
            stages.map((st, i) => (
              <div key={st.label}>
                <div className="flex justify-between mb-1 text-xs">
                  <span className="text-[#191c1e] font-medium">{st.label}</span>
                  <span className="font-bold text-[#191c1e] tabular-nums">{st.value.toLocaleString()} <span className="text-slate-400 font-normal">({Math.round(st.pct)}%)</span></span>
                </div>
                <div className="h-6 bg-[#f1f5f9] rounded-lg overflow-hidden">
                  <div className="h-full rounded-lg transition-all flex items-center"
                    style={{ width: `${Math.max(st.pct, 2)}%`, background: ["#2563eb", "#06b6d4", "#10b981"][i] }} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Recommended plan distribution */}
      {(data?.planDistribution.length ?? 0) > 0 && (
        <Card className="border-[#e2e8f0] shadow-sm mb-6">
          <CardHeader className="pb-2 pt-5 px-5"><CardTitle className="text-sm font-semibold text-[#191c1e]">Recommended plan mix</CardTitle></CardHeader>
          <CardContent className="px-5 pb-5 flex flex-wrap gap-2">
            {data!.planDistribution.map((p) => (
              <span key={p.plan ?? "none"} className="text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-slate-600 capitalize">
                {p.plan ?? "none"} <span className="font-bold text-slate-900">{p.total}</span>
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent sessions */}
      <Card className="border-[#e2e8f0] shadow-sm mb-6">
        <CardHeader className="pb-2 pt-5 px-5"><CardTitle className="text-sm font-semibold text-[#191c1e]">Recent chat sessions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#f1f5f9]">
                {["Started", "Recommended", "Signup", "Converted", "IP", ""].map((h, i) => (
                  <TableHead key={i} className={cn("text-[10px] uppercase tracking-wider text-[#64748b] font-semibold px-5", i === 5 && "text-right")}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="px-5 py-6"><Skeleton className="h-4 w-40" /></TableCell></TableRow>
              ) : (data?.recentSessions.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-slate-400">No sessions yet</TableCell></TableRow>
              ) : (
                data!.recentSessions.map((sn) => (
                  <TableRow key={sn.id} className="border-[#f1f5f9]">
                    <TableCell className="px-5 py-3 text-xs text-[#64748b]">{fmtDateTime(sn.createdAt)}</TableCell>
                    <TableCell className="px-5 py-3 text-xs capitalize">{sn.recommendedPlan ?? "—"}</TableCell>
                    <TableCell className="px-5 py-3 text-xs text-[#191c1e]">{sn.signupEmail ?? "—"}</TableCell>
                    <TableCell className="px-5 py-3">
                      {sn.convertedAt
                        ? <CheckCircle2 size={15} className="text-emerald-500" />
                        : <span className="text-xs text-slate-300">—</span>}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-xs font-mono text-[#64748b]">{sn.ipAddress ?? "—"}</TableCell>
                    <TableCell className="px-5 py-3 text-right">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-[#e2e8f0] gap-1"
                        disabled={!sn.transcript?.length} onClick={() => setTranscript(sn.transcript)}>
                        <MessageSquare size={12} /> {sn.transcript?.length ?? 0}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Enterprise inquiries inbox */}
      <Card className="border-[#e2e8f0] shadow-sm">
        <CardHeader className="pb-2 pt-5 px-5 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-[#191c1e] flex items-center gap-2">
            <Inbox size={16} /> Enterprise inquiries
          </CardTitle>
          {(data?.openInquiries ?? 0) > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{data!.openInquiries} open</span>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
          ) : (data?.inquiries.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-400 py-4">No inquiries yet</p>
          ) : (
            data!.inquiries.map((q) => (
              <div key={q.id} className={cn("rounded-xl border p-4", q.handledAt ? "border-slate-100 bg-slate-50/50 opacity-70" : "border-amber-200 bg-amber-50/40")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-[#191c1e] flex items-center gap-2">
                      <Building2 size={14} className="text-slate-400" /> {q.company}
                      <span className="text-xs font-normal text-slate-500">· {q.name}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-[#64748b]">
                      <span className="inline-flex items-center gap-1"><Mail size={12} /> {q.email}</span>
                      {q.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {q.phone}</span>}
                      <span className="text-slate-400">{fmtDateTime(q.createdAt)}</span>
                    </div>
                    {q.message && <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{q.message}</p>}
                    {q.handledAt && <p className="text-[10px] text-slate-400 mt-2">Handled by {q.handledBy} · {fmtDateTime(q.handledAt)}</p>}
                  </div>
                  <Button size="sm" variant="outline"
                    className={cn("shrink-0 h-8 text-xs gap-1", q.handledAt ? "border-slate-200" : "border-emerald-200 text-emerald-700")}
                    disabled={busy === q.id}
                    onClick={() => triage(q.id, !q.handledAt)}>
                    {busy === q.id ? <Loader2 size={13} className="animate-spin" />
                      : q.handledAt ? <><RotateCcw size={13} /> Reopen</> : <><CheckCircle2 size={13} /> Handled</>}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Transcript drawer */}
      <Sheet open={!!transcript} onOpenChange={(o) => { if (!o) setTranscript(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
            <SheetTitle className="text-base font-bold text-[#191c1e]">Chat transcript</SheetTitle>
          </SheetHeader>
          <div className="p-6 space-y-3">
            {(transcript ?? []).map((m, i) => (
              <div key={i} className={cn("rounded-xl px-4 py-2.5 text-sm max-w-[85%]",
                m.role === "user" ? "bg-blue-600 text-white ml-auto" : "bg-slate-100 text-slate-800")}>
                {m.content}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
