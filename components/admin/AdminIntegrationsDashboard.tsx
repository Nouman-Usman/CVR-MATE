"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  INK, MUTE, WARN, NEG, PROVIDER_COLOR, SYNC_COLOR,
  ConsoleShell, StatusHeader, RefreshButton, Ledger, LedgerTier, StatCell,
  Panel, Tag, ConsoleTable, ErrorBar, EmptyLine,
  rowClass, rowStyle, pctStr, num, fmtDate, fmtTime,
} from "./console";

interface IntegrationsData {
  generatedAt: string;
  summary: { activeConnections: number; totalSyncs7d: number; errorRate: number; expiringSoon: number };
  byProvider: { provider: string; total: number }[];
  syncStatus: { status: string; total: number }[];
  mappingBacklog: { syncStatus: string; total: number }[];
  connections: { provider: string; email: string; isActive: boolean; tokenExpiresAt: string | null; connectedAt: string; lastRefreshedAt: string | null; tokenExpiringSoon: boolean; tokenExpired: boolean }[];
  recentErrors: { id: string; action: string; status: string; errorMessage: string | null; createdAt: string }[];
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
    <ConsoleShell>
      <StatusHeader tone="neutral" eyebrow="crm sync health" title="CRM integrations">
        <RefreshButton onClick={() => refetch()} isFetching={isFetching} generatedAt={data?.generatedAt} />
      </StatusHeader>

      {isError && <ErrorBar message="couldn't read the integrations feed — sync health is unavailable." onRetry={() => refetch()} />}

      {/* ── VITALS LEDGER ── */}
      {isLoading || !s ? (
        <Skeleton className="mb-6 h-40 w-full rounded-xl" />
      ) : (
        <Ledger caption="integration readout">
          <LedgerTier cols={4}>
            <StatCell big label="Active connections" value={num(s.activeConnections)} sub="oauth links live" />
            <StatCell big label="Syncs · 7d" value={num(s.totalSyncs7d)} sub="push + pull ops" />
            <StatCell big danger={s.errorRate > 0.1} label="Error rate · 7d" value={pctStr(s.errorRate)} sub="failed / total" />
            <StatCell big danger={s.expiringSoon > 0} label="Tokens expiring" value={num(s.expiringSoon)} sub="within 3 days" />
          </LedgerTier>
        </Ledger>
      )}

      {/* ── Provider / sync status / mapping backlog chips ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="By provider">
          <div className="flex flex-wrap gap-2">
            {(data?.byProvider.length ?? 0) === 0 ? (
              <EmptyLine>none connected</EmptyLine>
            ) : (
              data!.byProvider.map((p) => (
                <Tag key={p.provider} color={PROVIDER_COLOR[p.provider] ?? MUTE}>{p.provider} {p.total}</Tag>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Sync status · 7d">
          <div className="flex flex-wrap gap-2">
            {(data?.syncStatus.length ?? 0) === 0 ? (
              <EmptyLine>no syncs recorded</EmptyLine>
            ) : (
              data!.syncStatus.map((s2) => (
                <Tag key={s2.status} color={SYNC_COLOR[s2.status] ?? MUTE}>{s2.status} {s2.total}</Tag>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Mapping backlog">
          <div className="flex flex-wrap gap-2">
            {(data?.mappingBacklog.length ?? 0) === 0 ? (
              <EmptyLine>no mappings</EmptyLine>
            ) : (
              data!.mappingBacklog.map((m) => (
                <Tag key={m.syncStatus} color={SYNC_COLOR[m.syncStatus] ?? MUTE}>{m.syncStatus} {m.total}</Tag>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* ── Connections ── */}
      <div className="mb-6">
        <Panel title="Connections">
          <ConsoleTable head={["provider", "owner", "token expiry", "connected", "last refresh"]}>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b" style={rowStyle}>
                  {Array.from({ length: 5 }).map((__, j) => <td key={j} className="py-3"><Skeleton className="h-4 w-16" /></td>)}
                </tr>
              ))
            ) : (data?.connections.length ?? 0) === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center"><EmptyLine>no CRM connections.</EmptyLine></td></tr>
            ) : (
              data!.connections.map((c, i) => (
                <tr key={i} className={cn(rowClass, !c.isActive && "opacity-50")} style={rowStyle}>
                  <td className="py-2.5">
                    <span className="font-mono text-[12px] font-bold capitalize" style={{ color: PROVIDER_COLOR[c.provider] ?? MUTE }}>{c.provider}</span>
                  </td>
                  <td className="py-2.5 font-mono text-[12px] text-slate-600">{c.email}</td>
                  <td className="py-2.5">
                    {c.tokenExpired ? (
                      <span className="font-mono text-[11px] font-bold" style={{ color: NEG }}>expired</span>
                    ) : c.tokenExpiringSoon ? (
                      <span className="font-mono text-[11px] font-bold" style={{ color: WARN }}>soon · {fmtDate(c.tokenExpiresAt)}</span>
                    ) : (
                      <span className="font-mono text-[11px] text-slate-500">{fmtDate(c.tokenExpiresAt)}</span>
                    )}
                  </td>
                  <td className="py-2.5 font-mono text-[11px] text-slate-500">{fmtDate(c.connectedAt)}</td>
                  <td className="py-2.5 text-right font-mono text-[11px] text-slate-500">{fmtTime(c.lastRefreshedAt)}</td>
                </tr>
              ))
            )}
          </ConsoleTable>
        </Panel>
      </div>

      {/* ── Recent errors ── */}
      <Panel title="Recent sync errors · 7d">
        <ConsoleTable head={["action", "error", "when"]}>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-b" style={rowStyle}>
                {Array.from({ length: 3 }).map((__, j) => <td key={j} className="py-3"><Skeleton className="h-4 w-24" /></td>)}
              </tr>
            ))
          ) : (data?.recentErrors.length ?? 0) === 0 ? (
            <tr><td colSpan={3} className="py-10 text-center"><EmptyLine>no sync errors this week — every provider is clean.</EmptyLine></td></tr>
          ) : (
            data!.recentErrors.map((e) => (
              <tr key={e.id} className="border-b" style={rowStyle}>
                <td className="py-2.5 font-mono text-[12px]" style={{ color: INK }}>{e.action}</td>
                <td className="max-w-[320px] truncate py-2.5 font-mono text-[11px]" style={{ color: NEG }}>{e.errorMessage ?? "—"}</td>
                <td className="whitespace-nowrap py-2.5 text-right font-mono text-[11px] text-slate-400">{fmtTime(e.createdAt)}</td>
              </tr>
            ))
          )}
        </ConsoleTable>
      </Panel>
    </ConsoleShell>
  );
}
