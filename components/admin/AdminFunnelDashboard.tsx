"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, Mail, Phone, CheckCircle2, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  INK, HAIR, MUTE, POS, WARN, CYAN, PLAN_COLOR,
  ConsoleShell, StatusHeader, RefreshButton, Panel, ConsoleTable, Tag,
  ActionButton, ErrorBar, EmptyLine, rowClass, rowStyle, fmtTime,
} from "./console";

interface Msg { role: string; content: string }
interface FunnelData {
  generatedAt: string;
  funnel: { sessions: number; signups: number; converted: number; signupRate: number; conversionRate: number };
  planDistribution: { plan: string | null; total: number }[];
  recentSessions: { id: string; createdAt: string; recommendedPlan: string | null; signupEmail: string | null; convertedAt: string | null; ipAddress: string | null; transcript: Msg[] }[];
  inquiries: { id: string; name: string; email: string; company: string; phone: string | null; message: string | null; createdAt: string; handledAt: string | null; handledBy: string | null }[];
  openInquiries: number;
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
    <ConsoleShell>
      <StatusHeader tone="neutral" eyebrow="chat-landing funnel" title="Conversion funnel">
        <RefreshButton onClick={() => refetch()} isFetching={isFetching} generatedAt={data?.generatedAt} />
      </StatusHeader>

      {isError && <ErrorBar message="couldn't load funnel data." onRetry={() => refetch()} />}

      <div className="space-y-6">
        {/* Funnel bars */}
        <Panel
          title="Chat-landing funnel"
          meta={f ? `signup ${Math.round(f.signupRate * 100)}% · conversion ${Math.round(f.conversionRate * 100)}%` : undefined}
        >
          <div className="space-y-3">
            {isLoading || !f ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)
            ) : (
              stages.map((st, i) => (
                <div key={st.label}>
                  <div className="mb-1 flex justify-between font-mono text-[11px]">
                    <span style={{ color: INK }}>{st.label}</span>
                    <span className="font-bold tabular-nums" style={{ color: INK }}>
                      {st.value.toLocaleString()} <span className="font-normal text-slate-400">({Math.round(st.pct)}%)</span>
                    </span>
                  </div>
                  <div className="h-6 overflow-hidden rounded-lg bg-slate-100">
                    <div className="h-full rounded-lg" style={{ width: `${Math.max(st.pct, 2)}%`, background: [INK, CYAN, POS][i] }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        {/* Recommended plan distribution */}
        {(data?.planDistribution.length ?? 0) > 0 && (
          <Panel title="Recommended plan mix">
            <div className="flex flex-wrap gap-2">
              {data!.planDistribution.map((p) => (
                <Tag key={p.plan ?? "none"} color={PLAN_COLOR[p.plan ?? "none"] ?? MUTE}>
                  {p.plan ?? "none"} {p.total}
                </Tag>
              ))}
            </div>
          </Panel>
        )}

        {/* Recent sessions */}
        <Panel title="Recent chat sessions">
          <ConsoleTable head={["started", "recommended", "signup", "converted", "ip", ""]}>
            {isLoading ? (
              <tr><td colSpan={6} className="py-6"><Skeleton className="h-4 w-40" /></td></tr>
            ) : (data?.recentSessions.length ?? 0) === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center"><EmptyLine>no sessions yet</EmptyLine></td></tr>
            ) : (
              data!.recentSessions.map((sn) => (
                <tr key={sn.id} className={rowClass} style={rowStyle}>
                  <td className="py-2.5 font-mono text-[11px] tabular-nums text-slate-500">{fmtTime(sn.createdAt)}</td>
                  <td className="py-2.5">
                    {sn.recommendedPlan
                      ? <Tag color={PLAN_COLOR[sn.recommendedPlan] ?? MUTE}>{sn.recommendedPlan}</Tag>
                      : <span className="font-mono text-[11px] text-slate-300">—</span>}
                  </td>
                  <td className="py-2.5 font-mono text-[11px] text-slate-600">{sn.signupEmail ?? "—"}</td>
                  <td className="py-2.5">
                    {sn.convertedAt
                      ? <span className="inline-block size-2 rounded-full" style={{ background: POS }} />
                      : <span className="font-mono text-[11px] text-slate-300">—</span>}
                  </td>
                  <td className="py-2.5 font-mono text-[11px] text-slate-400">{sn.ipAddress ?? "—"}</td>
                  <td className="py-2.5 text-right">
                    <ActionButton onClick={() => setTranscript(sn.transcript)} disabled={!sn.transcript?.length}>
                      <MessageSquare size={12} /> {sn.transcript?.length ?? 0}
                    </ActionButton>
                  </td>
                </tr>
              ))
            )}
          </ConsoleTable>
        </Panel>

        {/* Enterprise inquiries inbox */}
        <Panel
          title="Enterprise inquiries"
          right={(data?.openInquiries ?? 0) > 0
            ? <span className="font-mono text-[10px] font-bold" style={{ color: WARN }}>{data!.openInquiries} open</span>
            : undefined}
        >
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
            ) : (data?.inquiries.length ?? 0) === 0 ? (
              <EmptyLine>no inquiries yet</EmptyLine>
            ) : (
              data!.inquiries.map((q) => (
                <div key={q.id} className="rounded-xl border p-4"
                  style={{ borderColor: HAIR, background: q.handledAt ? "#FFFFFF" : "#FFF9EE", opacity: q.handledAt ? 0.6 : 1 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-mono text-[13px] font-bold" style={{ color: INK }}>
                        {q.company}
                        <span className="font-normal text-slate-500">· {q.name}</span>
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1"><Mail size={12} className="text-slate-400" /> {q.email}</span>
                        {q.phone && <span className="inline-flex items-center gap-1"><Phone size={12} className="text-slate-400" /> {q.phone}</span>}
                        <span className="text-slate-400">{fmtTime(q.createdAt)}</span>
                      </div>
                      {q.message && <p className="mt-2 whitespace-pre-wrap font-mono text-[12px] text-slate-600">{q.message}</p>}
                      {q.handledAt && <p className="mt-2 font-mono text-[10px] text-slate-400">handled by {q.handledBy} · {fmtTime(q.handledAt)}</p>}
                    </div>
                    <div className="shrink-0">
                      <ActionButton onClick={() => triage(q.id, !q.handledAt)} busy={busy === q.id} tone={q.handledAt ? "neutral" : "primary"}>
                        {q.handledAt ? <><RotateCcw size={13} /> reopen</> : <><CheckCircle2 size={13} /> handled</>}
                      </ActionButton>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* Transcript drawer */}
      <Sheet open={!!transcript} onOpenChange={(o) => { if (!o) setTranscript(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-lg" style={{ background: "#FFFFFF" }}>
          <SheetHeader className="border-b px-6 pb-4 pt-6" style={{ borderColor: HAIR }}>
            <SheetTitle className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-600">Chat transcript</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 p-6">
            {(transcript ?? []).map((m, i) => (
              <div key={i}
                className={`max-w-[85%] rounded-xl px-4 py-2.5 font-mono text-[13px] ${m.role === "user" ? "ml-auto" : ""}`}
                style={{ background: m.role === "user" ? INK : "#F1F5F9", color: m.role === "user" ? "#FFFFFF" : "#334155" }}>
                {m.content}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </ConsoleShell>
  );
}
