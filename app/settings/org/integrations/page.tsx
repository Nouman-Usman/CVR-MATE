"use client";

import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useIntegrations,
  useCrmDisconnect,
  useSyncHistory,
} from "@/lib/hooks/use-integrations";
import { cn } from "@/lib/utils";
import {
  Plug,
  Check,
  X,
  ArrowUpRight,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Link2Off,
} from "lucide-react";

// ─── CRM provider metadata ─────────────────────────────────────────────────

const CRM_PROVIDERS = [
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Sync contacts, companies, and deals with HubSpot CRM.",
    logo: "https://cdn.worldvectorlogo.com/logos/hubspot-1.svg",
    color: "from-orange-500/10 to-red-500/10",
    accent: "text-orange-600",
    connectUrl: "/api/integrations/hubspot/connect",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Push leads and accounts to Salesforce. Bi-directional sync.",
    logo: "https://cdn.worldvectorlogo.com/logos/salesforce-2.svg",
    color: "from-blue-500/10 to-sky-500/10",
    accent: "text-blue-600",
    connectUrl: "/api/integrations/salesforce/connect",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Sync organizations and deals with your Pipedrive pipeline.",
    logo: "https://cdn.worldvectorlogo.com/logos/pipedrive-1.svg",
    color: "from-emerald-500/10 to-green-500/10",
    accent: "text-emerald-600",
    connectUrl: "/api/integrations/pipedrive/connect",
  },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusIcon(status: string) {
  if (status === "success") return <CheckCircle2 className="size-3.5 text-emerald-500" />;
  if (status === "error") return <XCircle className="size-3.5 text-red-500" />;
  if (status === "skipped") return <AlertCircle className="size-3.5 text-amber-500" />;
  return <Clock className="size-3.5 text-muted-foreground" />;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    success: "bg-emerald-500/10 text-emerald-600 border-0",
    error: "bg-red-500/10 text-red-600 border-0",
    skipped: "bg-amber-500/10 text-amber-600 border-0",
    conflict: "bg-violet-500/10 text-violet-600 border-0",
  };
  return map[status] ?? "bg-muted text-muted-foreground border-0";
}

// ─── Provider card ──────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  connection,
  onConnect,
  onDisconnect,
  isDisconnecting,
}: {
  provider: (typeof CRM_PROVIDERS)[number];
  connection?: { id: string; isActive: boolean; connectedAt: string; lastRefreshedAt: string | null };
  onConnect: () => void;
  onDisconnect: () => void;
  isDisconnecting: boolean;
}) {
  const isConnected = !!connection?.isActive;

  return (
    <div className={cn(
      "rounded-xl border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-shadow hover:shadow-sm",
      isConnected && "ring-1 ring-emerald-200/50 border-emerald-200/50"
    )}>
      {/* Logo + info */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={cn("size-12 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0", provider.color)}>
          <img
            src={provider.logo}
            alt={provider.name}
            className="size-7 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-lg font-bold ${provider.accent}">${provider.name[0]}</span>`;
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{provider.name}</h3>
            {isConnected && (
              <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px] h-5 font-semibold">
                <Check className="size-3 mr-0.5" />
                Connected
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {provider.description}
          </p>
          {isConnected && connection?.connectedAt && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Connected {timeAgo(connection.connectedAt)}
              {connection.lastRefreshedAt && ` · Token refreshed ${timeAgo(connection.lastRefreshedAt)}`}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {isConnected ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => window.open(`https://${provider.id === "hubspot" ? "app.hubspot.com" : provider.id === "salesforce" ? "login.salesforce.com" : "app.pipedrive.com"}`, "_blank")}
            >
              Open {provider.name}
              <ArrowUpRight className="size-3 ml-1" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={onDisconnect}
              disabled={isDisconnecting}
            >
              <Link2Off className="size-3.5 mr-1" />
              {isDisconnecting ? "..." : "Disconnect"}
            </Button>
          </>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={onConnect}
          >
            <Plug className="size-3.5 mr-1.5" />
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { data, isLoading } = useIntegrations();
  const disconnect = useCrmDisconnect();
  const { data: historyData, isLoading: historyLoading } = useSyncHistory();

  const connections = data?.connections ?? [];
  const logs = historyData?.logs ?? [];

  function getConnection(providerId: string) {
    return connections.find((c) => c.provider === providerId && c.isActive);
  }

  function handleConnect(connectUrl: string) {
    window.location.href = connectUrl;
  }

  function handleDisconnect(provider: string) {
    if (!confirm(`Disconnect ${provider}? Existing sync mappings will be preserved.`)) return;
    disconnect.mutate(provider, {
      onSuccess: () => toast.success(`${provider} disconnected`),
      onError: () => toast.error(`Failed to disconnect ${provider}`),
    });
  }

  return (
    <div className="space-y-8">
      {/* ── CRM Integrations ─────────────────────────────────────────── */}
      <div>
        <div className="mb-5">
          <h2 className="text-xl font-bold tracking-tight">Integrations</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect your CRM to sync companies, contacts, and deals automatically.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {CRM_PROVIDERS.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                connection={getConnection(provider.id)}
                onConnect={() => handleConnect(provider.connectUrl)}
                onDisconnect={() => handleDisconnect(provider.id)}
                isDisconnecting={disconnect.isPending && disconnect.variables === provider.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Sync overview ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Sync Activity</CardTitle>
              <CardDescription>Recent synchronization events across all connected CRMs.</CardDescription>
            </div>
            {connections.filter(c => c.isActive).length > 0 && (
              <Badge variant="outline" className="text-xs font-normal gap-1">
                <RefreshCw className="size-3" />
                {connections.filter(c => c.isActive).length} active {connections.filter(c => c.isActive).length === 1 ? "connection" : "connections"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {historyLoading ? (
            <div className="px-4 pb-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center px-4">
              <RefreshCw className="size-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No sync activity yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Connect a CRM and push your first company to see sync logs here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b bg-muted/40">
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Provider</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Action</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Entity</th>
                    <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          {statusIcon(log.status)}
                          <Badge className={cn("text-[10px] h-5 font-semibold capitalize", statusBadge(log.status))}>
                            {log.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-medium capitalize">{log.connection?.provider ?? "—"}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-muted-foreground">{log.action.replace(/_/g, " ")}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        {log.crmEntityId ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                            {log.crmEntityId.slice(0, 12)}...
                          </code>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">
                        {timeAgo(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Coming soon ──────────────────────────────────────────────── */}
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <div className="size-12 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-3">
            <Plug className="size-5 text-violet-500" />
          </div>
          <h3 className="font-semibold text-sm mb-1">More integrations coming soon</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            We&apos;re working on Slack notifications, webhook integrations, Zapier, and more.
            Have a request? Let us know.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
