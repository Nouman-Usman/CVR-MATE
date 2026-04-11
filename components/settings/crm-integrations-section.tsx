"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  useIntegrations,
  useCrmDisconnect,
  useSyncHistory,
  useConnectionHealthCheck,
} from "@/lib/hooks/use-integrations";
import { useSubscription } from "@/lib/hooks/use-subscription";
import { Loader2, ArrowUpRight, Lock, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Plug } from "lucide-react";

const CRM_CARDS: {
  provider: "hubspot" | "leadconnector" | "pipedrive";
  name: string;
  color: string;
  icon: string;
  desc: string;
  descDa: string;
}[] = [
  {
    provider: "hubspot",
    name: "HubSpot",
    color: "#FF7A59",
    icon: "hub",
    desc: "Sync companies to HubSpot CRM",
    descDa: "Synkroniser virksomheder til HubSpot CRM",
  },
  {
    provider: "leadconnector",
    name: "GoHighLevel",
    color: "#FF6B35",
    icon: "rocket_launch",
    desc: "Push leads to GoHighLevel CRM",
    descDa: "Send leads til GoHighLevel CRM",
  },
  {
    provider: "pipedrive",
    name: "Pipedrive",
    color: "#017737",
    icon: "filter_alt",
    desc: "Send companies to Pipedrive",
    descDa: "Send virksomheder til Pipedrive",
  },
];

export default function CrmIntegrationsSection() {
  const { t, locale } = useLanguage();
  const ig = t.integrations as Record<string, string>;
  const { data: intData, isLoading: intLoading } = useIntegrations();
  const { data: sub } = useSubscription();
  const disconnectMutation = useCrmDisconnect();
  const healthCheck = useConnectionHealthCheck();
  const { data: historyData } = useSyncHistory();
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
  const [healthResults, setHealthResults] = useState<Record<string, { healthy: boolean; latencyMs: number; error?: string }>>({});

  const connections = intData?.connections ?? [];
  const connMap = new Map(connections.filter((c) => c.isActive).map((c) => [c.provider, c]));
  const logs = historyData?.logs ?? [];

  // Plan gating
  const crmLimit = sub?.limits?.crmConnections ?? 0;
  const canUseCrm = crmLimit > 0;
  const activeCount = connMap.size;
  const bulkPushUsage = sub?.usage?.bulkPush;
  const bulkLimit = sub?.limits?.bulkPushPerMonth ?? 0;

  const handleConnect = (provider: string) => {
    window.location.href = `/api/integrations/${provider}/connect`;
  };

  const handleDisconnect = (provider: string) => {
    disconnectMutation.mutate(provider, {
      onSuccess: () => setConfirmDisconnect(null),
    });
  };

  const handleHealthCheck = (connectionId: string, provider: string) => {
    healthCheck.mutate(connectionId, {
      onSuccess: (result) => {
        setHealthResults((prev) => ({ ...prev, [provider]: result }));
      },
      onError: (err) => {
        setHealthResults((prev) => ({
          ...prev,
          [provider]: { healthy: false, latencyMs: 0, error: err.message },
        }));
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Plug className="w-5 h-5 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {ig.title}
            </h2>
          </div>
          {canUseCrm && (
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>
                <span className="font-semibold text-slate-700">{activeCount}</span>
                /{crmLimit} {ig.connectionLimit}
              </span>
              {bulkLimit > 0 && bulkPushUsage && (
                <span>
                  <span className="font-semibold text-slate-700">{bulkPushUsage.used}</span>
                  /{bulkPushUsage.limit === -1 ? "∞" : bulkPushUsage.limit} {ig.bulkQuota}
                </span>
              )}
            </div>
          )}
        </div>
        <p className="text-sm text-slate-400 mb-6">{ig.subtitle}</p>

        {/* Upgrade Banner for Free/Starter users */}
        {!canUseCrm && (
          <div className="mb-6 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-6 text-center">
            <Lock className="w-8 h-8 text-indigo-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800 mb-1">{ig.upgradeRequired}</p>
            <p className="text-xs text-slate-500 mb-4">{ig.upgradeDesc}</p>
            <button
              onClick={() => {
                const el = document.querySelector('[data-section="subscription"]');
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {ig.upgradeCta}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* CRM Provider Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {CRM_CARDS.map((crm) => {
            const conn = connMap.get(crm.provider);
            const isConnected = !!conn;
            const health = healthResults[crm.provider];
            const isDisabled = !canUseCrm;

            return (
              <div
                key={crm.provider}
                className={`relative rounded-xl border-2 p-5 transition-all ${
                  isConnected
                    ? "border-emerald-200 bg-emerald-50/30"
                    : isDisabled
                    ? "border-slate-100 bg-slate-50/20 opacity-60"
                    : "border-slate-100 bg-slate-50/30 hover:border-slate-200"
                }`}
              >
                {/* Lock overlay for disabled */}
                {isDisabled && !isConnected && (
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-white/40 backdrop-blur-[1px] z-10">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                      <Lock className="w-3 h-3" />
                      Professional+
                    </div>
                  </div>
                )}

                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: crm.color + "18" }}
                  >
                    <span
                      className="material-symbols-outlined text-xl"
                      style={{ color: crm.color }}
                    >
                      {crm.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{crm.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {locale === "da" ? crm.descDa : crm.desc}
                    </p>
                  </div>
                </div>

                {isConnected && conn ? (
                  <div>
                    {/* Connected status */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                      <span className="text-xs font-semibold text-emerald-700">
                        {ig.connected}
                      </span>
                      {health && (
                        <span
                          className={`ml-auto text-[10px] font-medium ${
                            health.healthy ? "text-emerald-600" : "text-red-500"
                          }`}
                        >
                          {health.healthy
                            ? `${ig.latency}: ${health.latencyMs}ms`
                            : health.error?.slice(0, 30)}
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-400 mb-3">
                      {ig.connectedSince}{" "}
                      {new Date(conn.connectedAt).toLocaleDateString(locale === "da" ? "da-DK" : "en-US")}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleHealthCheck(conn.id, crm.provider)}
                        disabled={healthCheck.isPending}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        {healthCheck.isPending && healthCheck.variables === conn.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        {healthCheck.isPending && healthCheck.variables === conn.id
                          ? ig.testing
                          : ig.testConnection}
                      </button>

                      {confirmDisconnect === crm.provider ? (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            onClick={() => handleDisconnect(crm.provider)}
                            disabled={disconnectMutation.isPending}
                            className="px-2.5 py-1.5 bg-red-500 text-white text-[11px] font-semibold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            {ig.disconnect}
                          </button>
                          <button
                            onClick={() => setConfirmDisconnect(null)}
                            className="px-2.5 py-1.5 border border-slate-200 text-[11px] font-medium text-slate-600 rounded-lg hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDisconnect(crm.provider)}
                          className="ml-auto text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors"
                        >
                          {ig.disconnect}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(crm.provider)}
                    disabled={intLoading || isDisabled}
                    className="w-full px-4 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: isDisabled ? "#94a3b8" : crm.color }}
                  >
                    {ig.connect} {crm.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Connection Limit Progress Bar */}
        {canUseCrm && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>{ig.connectionLimit}</span>
              <span className="font-semibold text-slate-700">
                {activeCount}/{crmLimit}
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((activeCount / crmLimit) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Bulk Push Quota Progress */}
        {canUseCrm && bulkLimit > 0 && bulkPushUsage && bulkPushUsage.limit !== -1 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>{ig.bulkQuota}</span>
              <span className="font-semibold text-slate-700">
                {bulkPushUsage.used}/{bulkPushUsage.limit}
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  bulkPushUsage.used / bulkPushUsage.limit > 0.8 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min((bulkPushUsage.used / bulkPushUsage.limit) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Sync History Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-4 sm:p-6 md:p-8">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
          {ig.syncHistory}
        </h3>

        {logs.length === 0 ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">{ig.noSyncHistory}</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 text-xs py-2.5 px-3 rounded-lg hover:bg-slate-50/60 transition-colors"
              >
                {log.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : log.status === "error" ? (
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                )}

                <span className="font-semibold text-slate-700 capitalize min-w-[70px]">
                  {log.connection.provider}
                </span>

                <span className="text-slate-500 truncate flex-1">
                  {log.action.replace(/_/g, " ")}
                  {log.errorMessage && (
                    <span className="text-red-400 ml-1">— {log.errorMessage.slice(0, 60)}</span>
                  )}
                </span>

                <span className="text-slate-400 flex-shrink-0 tabular-nums">
                  {formatTimeAgo(log.createdAt, locale)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string, locale: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (locale === "da") {
    if (minutes < 1) return "lige nu";
    if (minutes < 60) return `${minutes} min siden`;
    if (hours < 24) return `${hours}t siden`;
    return `${days}d siden`;
  }

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
