"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  INK, MUTE, NEG, POS, SYNC_COLOR,
  ConsoleShell, StatusHeader, RefreshButton, Ledger, LedgerTier, StatCell,
  Panel, ConsoleTable, Tag, ErrorBar, EmptyLine, rowClass, rowStyle,
  num, pctStr, fmtTime,
} from "./console";

interface EmailData {
  generatedAt: string;
  summary: {
    dispatched: number; sent: number; failed: number; delivered: number; bounced: number; opened: number; clicked: number;
    bounceRate: number; deliveryRate: number; openRate: number; clickRate: number; failureRate: number;
  };
  byTemplate: { templateId: string; total: number; bounced: number; failed: number }[];
  failures: { id: string; to: string; subject: string; templateId: string | null; status: string; deliveryStatus: string | null; error: string | null; createdAt: string }[];
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
    <ConsoleShell>
      <StatusHeader tone="neutral" eyebrow="last 30 days" title="Email deliverability">
        <RefreshButton onClick={() => refetch()} isFetching={isFetching} generatedAt={data?.generatedAt} />
      </StatusHeader>

      {isError && (
        <ErrorBar message="metrics feed unreachable — couldn't read email deliverability data." onRetry={() => refetch()} />
      )}

      {/* ── Deliverability ledger — signature ── */}
      {isLoading || !s ? (
        <Skeleton className="mb-6 h-56 w-full rounded-xl" />
      ) : (
        <Ledger caption="deliverability readout">
          <LedgerTier cols={4}>
            <StatCell big label="Sent" value={num(s.sent)} sub={`${num(s.dispatched)} dispatched`} />
            <StatCell big label="Delivered" value={num(s.delivered)} sub={pctStr(s.deliveryRate)} />
            <StatCell big danger={s.bounceRate > 0.05} label="Bounced" value={num(s.bounced)} sub={pctStr(s.bounceRate)} />
            <StatCell big danger={s.failed > 0} label="Failed" value={num(s.failed)} sub={pctStr(s.failureRate)} />
          </LedgerTier>
          <LedgerTier cols={4} top>
            <StatCell label="Opened" value={num(s.opened)} sub={pctStr(s.openRate)} />
            <StatCell label="Clicked" value={num(s.clicked)} sub={pctStr(s.clickRate)} />
            <StatCell danger={s.bounceRate > 0.05} label="Bounce rate" value={pctStr(s.bounceRate)} sub="delivered basis" />
            <StatCell label="Open rate" value={pctStr(s.openRate)} sub="of sent" />
          </LedgerTier>
        </Ledger>
      )}

      <div className="space-y-6">
        {/* ── By template ── */}
        <Panel title="By template" meta="last 30 days">
          <ConsoleTable head={["template", "sent", "bounced", "failed", "bounce %"]}>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b" style={rowStyle}>
                  {Array.from({ length: 5 }).map((__, j) => <td key={j} className="py-3"><Skeleton className="h-4 w-16" /></td>)}
                </tr>
              ))
            ) : (data?.byTemplate.length ?? 0) === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center"><EmptyLine>no email sent in the last 30 days.</EmptyLine></td></tr>
            ) : (
              data!.byTemplate.map((t) => {
                const br = t.total > 0 ? t.bounced / t.total : 0;
                return (
                  <tr key={t.templateId} className={rowClass} style={rowStyle}>
                    <td className="py-2.5 font-mono text-[12px]" style={{ color: INK }}>{t.templateId}</td>
                    <td className="py-2.5 text-right font-mono text-[11px] tabular-nums text-slate-500">{num(t.total)}</td>
                    <td className="py-2.5 text-right font-mono text-[11px] tabular-nums text-slate-500">{num(t.bounced)}</td>
                    <td className="py-2.5 text-right font-mono text-[11px] tabular-nums text-slate-500">{num(t.failed)}</td>
                    <td className="py-2.5 text-right font-mono text-[11px] font-bold tabular-nums" style={{ color: br > 0.05 ? NEG : MUTE }}>{pctStr(br)}</td>
                  </tr>
                );
              })
            )}
          </ConsoleTable>
        </Panel>

        {/* ── Recent failures & bounces ── */}
        <Panel title="Recent failures & bounces">
          <ConsoleTable head={["to", "subject", "state", "error", "when"]}>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b" style={rowStyle}>
                  {Array.from({ length: 5 }).map((__, j) => <td key={j} className="py-3"><Skeleton className="h-4 w-20" /></td>)}
                </tr>
              ))
            ) : (data?.failures.length ?? 0) === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center"><span className="font-mono text-[11px] font-bold" style={{ color: POS }}>no failures or bounces</span></td></tr>
            ) : (
              data!.failures.map((f) => (
                <tr key={f.id} className={rowClass} style={rowStyle}>
                  <td className="py-2.5 font-mono text-[12px]" style={{ color: INK }}>{f.to}</td>
                  <td className="max-w-[180px] truncate py-2.5 font-mono text-[11px] text-slate-500">{f.subject}</td>
                  <td className="py-2.5"><Tag color={SYNC_COLOR[f.deliveryStatus ?? f.status] ?? NEG}>{f.deliveryStatus ?? f.status}</Tag></td>
                  <td className="max-w-[200px] truncate py-2.5 font-mono text-[11px]" style={{ color: NEG }}>{f.error ?? "—"}</td>
                  <td className="whitespace-nowrap py-2.5 text-right font-mono text-[11px] tabular-nums text-slate-400">{fmtTime(f.createdAt)}</td>
                </tr>
              ))
            )}
          </ConsoleTable>
        </Panel>
      </div>
    </ConsoleShell>
  );
}
