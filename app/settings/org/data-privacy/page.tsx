"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Database,
  Download,
  Clock,
  ShieldCheck,
  FileDown,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RetentionPolicy {
  activityRetentionDays: number;
  auditLogRetentionDays: number;
  deletedDataRetentionDays: number;
  exportRetentionDays: number;
}

interface ExportRequest {
  id: string;
  type: string;
  status: string;
  downloadUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
  requestedByName: string;
  requestedByEmail: string;
}

// ─── Retention field ────────────────────────────────────────────────────────

function RetentionField({
  label,
  description,
  icon: Icon,
  value,
  onChange,
  suffix,
}: {
  label: string;
  description: string;
  icon: typeof Clock;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-start gap-4 py-4">
      <div className="size-9 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="size-4 text-blue-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input
          type="number"
          min={1}
          max={3650}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 1)}
          className="w-20 text-center tabular-nums text-sm h-9"
        />
        <span className="text-xs text-muted-foreground font-medium">{suffix ?? "days"}</span>
      </div>
    </div>
  );
}

// ─── Status helpers ─────────────────────────────────────────────────────────

function exportStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-0 text-[10px] h-5 font-semibold gap-1">
          <Loader2 className="size-3 animate-spin" /> Pending
        </Badge>
      );
    case "processing":
      return (
        <Badge className="bg-blue-500/10 text-blue-600 border-0 text-[10px] h-5 font-semibold gap-1">
          <Loader2 className="size-3 animate-spin" /> Processing
        </Badge>
      );
    case "ready":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px] h-5 font-semibold gap-1">
          <CheckCircle2 className="size-3" /> Ready
        </Badge>
      );
    case "expired":
      return (
        <Badge className="bg-slate-500/10 text-slate-500 border-0 text-[10px] h-5 font-semibold gap-1">
          <Clock className="size-3" /> Expired
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-[10px] h-5">{status}</Badge>;
  }
}

function exportTypeLabel(type: string) {
  switch (type) {
    case "gdpr_export": return "GDPR Data Export";
    case "bulk_export": return "Bulk Data Export";
    case "account_deletion": return "Account Deletion";
    default: return type;
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DataPrivacyPage() {
  const [retention, setRetention] = useState<RetentionPolicy>({
    activityRetentionDays: 365,
    auditLogRetentionDays: 730,
    deletedDataRetentionDays: 30,
    exportRetentionDays: 90,
  });
  const [exports, setExports] = useState<ExportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/data-privacy");
      if (res.ok) {
        const data = await res.json();
        setRetention(data.retention);
        setExports(data.exports);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSaveRetention() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/data-privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_retention", ...retention }),
      });
      if (res.ok) {
        toast.success("Retention policy updated");
      } else {
        toast.error("Failed to update retention policy");
      }
    } catch {
      toast.error("Failed to update retention policy");
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestExport(type: string) {
    setRequesting(type);
    try {
      const res = await fetch("/api/admin/data-privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_export", type }),
      });
      if (res.ok) {
        toast.success("Export requested — you'll be notified when it's ready.");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to request export");
      }
    } catch {
      toast.error("Failed to request export");
    } finally {
      setRequesting(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">Data & Privacy</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure data retention policies and manage GDPR data requests.
        </p>
      </div>

      {/* ── Retention Policy ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center">
              <Database className="size-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-base">Data Retention</CardTitle>
              <CardDescription>
                Define how long different types of data are kept before automatic cleanup.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div>
              <div className="divide-y">
                <RetentionField
                  label="Activity Log"
                  description="User actions, views, and interactions within the workspace."
                  icon={Clock}
                  value={retention.activityRetentionDays}
                  onChange={(v) => setRetention((p) => ({ ...p, activityRetentionDays: v }))}
                />
                <RetentionField
                  label="Audit Log"
                  description="Security events, role changes, settings modifications, and login history."
                  icon={ShieldCheck}
                  value={retention.auditLogRetentionDays}
                  onChange={(v) => setRetention((p) => ({ ...p, auditLogRetentionDays: v }))}
                />
                <RetentionField
                  label="Deleted Data"
                  description="Soft-deleted records (companies, notes, tasks) before permanent removal."
                  icon={Trash2}
                  value={retention.deletedDataRetentionDays}
                  onChange={(v) => setRetention((p) => ({ ...p, deletedDataRetentionDays: v }))}
                />
                <RetentionField
                  label="Export Files"
                  description="Generated export files (CSV, PDF) before they expire and are cleaned up."
                  icon={FileDown}
                  value={retention.exportRetentionDays}
                  onChange={(v) => setRetention((p) => ({ ...p, exportRetentionDays: v }))}
                />
              </div>
              <div className="flex justify-end mt-5">
                <Button onClick={handleSaveRetention} disabled={saving}>
                  {saving ? "Saving..." : "Save Policy"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Data Export Requests ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center">
                <Download className="size-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-base">Data Exports</CardTitle>
                <CardDescription>
                  Request a full export of your organization&apos;s data for compliance or migration.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Request buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-blue-500" />
                <p className="text-sm font-semibold">GDPR Data Export</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Export all personal data associated with your organization as required by GDPR Article 20.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleRequestExport("gdpr_export")}
                disabled={requesting === "gdpr_export"}
              >
                {requesting === "gdpr_export" ? (
                  <><Loader2 className="size-3.5 animate-spin mr-1.5" /> Requesting...</>
                ) : (
                  <><Download className="size-3.5 mr-1.5" /> Request GDPR Export</>
                )}
              </Button>
            </div>
            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileDown className="size-4 text-violet-500" />
                <p className="text-sm font-semibold">Bulk Data Export</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Export all workspace data including companies, notes, triggers, and CRM mappings.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleRequestExport("bulk_export")}
                disabled={requesting === "bulk_export"}
              >
                {requesting === "bulk_export" ? (
                  <><Loader2 className="size-3.5 animate-spin mr-1.5" /> Requesting...</>
                ) : (
                  <><Download className="size-3.5 mr-1.5" /> Request Bulk Export</>
                )}
              </Button>
            </div>
          </div>

          {/* Export history */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : exports.length === 0 ? (
            <div className="rounded-xl border border-dashed py-8 text-center">
              <FileDown className="size-10 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-medium">No export requests yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Request an export above to see it listed here.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Type</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Requested By</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Date</th>
                    <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {exports.map((exp) => (
                    <tr key={exp.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-4">
                        <span className="font-medium">{exportTypeLabel(exp.type)}</span>
                      </td>
                      <td className="py-2.5 px-4">{exportStatusBadge(exp.status)}</td>
                      <td className="py-2.5 px-4">
                        <div>
                          <p className="text-sm">{exp.requestedByName}</p>
                          <p className="text-[11px] text-muted-foreground">{exp.requestedByEmail}</p>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="size-3" />
                          {new Date(exp.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {exp.status === "ready" && exp.downloadUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => window.open(exp.downloadUrl!, "_blank")}
                          >
                            <Download className="size-3 mr-1" /> Download
                          </Button>
                        ) : exp.status === "expired" ? (
                          <span className="text-xs text-muted-foreground">Expired</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">In progress</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── GDPR info ────────────────────────────────────────────────── */}
      <Card className="border-blue-200/50 bg-blue-50/30">
        <CardContent className="py-5">
          <div className="flex items-start gap-4">
            <div className="size-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="size-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-blue-900">GDPR Compliance</h3>
              <p className="text-xs text-blue-700/80 mt-1 leading-relaxed">
                CVR-MATE processes company data from the Danish CVR registry, which is public information.
                Personal data (user accounts, notes, activity logs) is handled in accordance with GDPR.
                You can request a full data export or account deletion at any time. Retention policies
                ensure data is automatically cleaned up according to your configured schedule.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
