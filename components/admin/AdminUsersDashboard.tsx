"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search, ChevronLeft, ChevronRight, ShieldCheck, MailCheck, LogOut as RevokeIcon,
  Rocket, Trash2, X, Loader2, Users as UsersIcon, Globe, Monitor,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const PLAN_COLOR: Record<string, string> = {
  free: "#94a3b8", starter: "#2563eb", professional: "#8b5cf6", enterprise: "#10b981",
};
const STATUS_COLOR: Record<string, string> = {
  active: "#10b981", trialing: "#06b6d4", past_due: "#f59e0b",
  canceled: "#ef4444", unpaid: "#ef4444", incomplete: "#94a3b8",
};
const PLANS = ["free", "starter", "professional", "enterprise"];

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}
function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function PlanTag({ plan }: { plan: string | null }) {
  const p = plan ?? "free";
  const c = PLAN_COLOR[p] ?? "#94a3b8";
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize border"
      style={{ color: c, background: `${c}15`, borderColor: `${c}40` }}>{p}</span>
  );
}
function StatusTag({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-slate-400">—</span>;
  const c = STATUS_COLOR[status] ?? "#94a3b8";
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
      style={{ color: c, background: `${c}15` }}>{status.replace("_", " ")}</span>
  );
}

// ── Types ──
interface UserRow {
  id: string; name: string; email: string; emailVerified: boolean;
  language: string | null; createdAt: string;
  plan: string | null; status: string | null; trialEnd: string | null;
}
interface UserDetail {
  user: { id: string; name: string; email: string; emailVerified: boolean; image: string | null; language: string | null; createdAt: string; updatedAt: string };
  subscription: { plan: string; status: string; trialStart: string | null; trialEnd: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; stripeCustomerId: string | null } | null;
  sessions: { id: string; ipAddress: string | null; userAgent: string | null; createdAt: string; updatedAt: string; expiresAt: string }[];
  usage: { feature: string; total: number }[];
  activity: { id: string; entityType: string; action: string; createdAt: string }[];
  memberships: { role: string; orgId: string; orgName: string }[];
  providers: string[];
}

export function AdminUsersDashboard() {
  const qc = useQueryClient();
  const focusId = useSearchParams().get("focus");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [plan, setPlan] = useState("");
  const [verified, setVerified] = useState("");
  const [page, setPage] = useState(1);
  // Initialise from the overview "click a row" drill-down (?focus=<id>).
  const [selected, setSelected] = useState<string | null>(() => focusId);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const limit = 25;
  const { data, isLoading, isError, refetch } = useQuery<{ users: UserRow[]; total: number; page: number; limit: number }>({
    queryKey: ["admin-users", debouncedQ, plan, verified, page],
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedQ) sp.set("q", debouncedQ);
      if (plan) sp.set("plan", plan);
      if (verified) sp.set("verified", verified);
      const res = await fetch(`/api/admin/users?${sp}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 15_000,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#191c1e] flex items-center gap-2">
            <UsersIcon size={22} className="text-blue-600" /> User Management
          </h1>
          <p className="text-sm text-[#64748b] mt-1">{total.toLocaleString()} user{total === 1 ? "" : "s"} · search, inspect & act</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-[#e2e8f0] shadow-sm mb-4">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="pl-9 border-[#e2e8f0]" />
          </div>
          <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-[#e2e8f0] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-blue-400">
            <option value="">All plans</option>
            {PLANS.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
          </select>
          <select value={verified} onChange={(e) => { setVerified(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-[#e2e8f0] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-blue-400">
            <option value="">All statuses</option>
            <option value="true">Verified</option>
            <option value="false">Pending</option>
          </select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-[#e2e8f0] shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#f1f5f9]">
                {["User", "Plan", "Status", "Verified", "Lang", "Joined"].map((h) => (
                  <TableHead key={h} className="text-[10px] uppercase tracking-wider text-[#64748b] font-semibold px-5">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-[#f1f5f9]">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j} className="px-5"><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-sm text-rose-600">
                  Failed to load. <button className="underline" onClick={() => refetch()}>Retry</button>
                </TableCell></TableRow>
              ) : (data?.users.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-sm text-slate-400">No users match your filters.</TableCell></TableRow>
              ) : (
                data!.users.map((u) => (
                  <TableRow key={u.id} onClick={() => setSelected(u.id)}
                    className="border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer">
                    <TableCell className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#191c1e] truncate">{u.name}</p>
                          <p className="text-xs text-[#64748b] truncate">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-3"><PlanTag plan={u.plan} /></TableCell>
                    <TableCell className="px-5 py-3"><StatusTag status={u.status} /></TableCell>
                    <TableCell className="px-5 py-3">
                      {u.emailVerified
                        ? <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Verified</Badge>
                        : <Badge variant="secondary" className="bg-[#f1f5f9] text-[#64748b] text-[10px]">Pending</Badge>}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-xs text-[#64748b] uppercase">{u.language ?? "—"}</TableCell>
                    <TableCell className="px-5 py-3 text-xs text-[#64748b] whitespace-nowrap">{timeAgo(u.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-[#64748b]">Showing {from}–{to} of {total.toLocaleString()}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-[#e2e8f0]" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft size={14} /> Prev
          </Button>
          <span className="text-xs text-[#64748b] tabular-nums">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" className="border-[#e2e8f0]" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      {/* Detail drawer */}
      <UserDrawer
        userId={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["admin-users"] });
          if (selected) qc.invalidateQueries({ queryKey: ["admin-user", selected] });
        }}
        onDeleted={() => {
          setSelected(null);
          qc.invalidateQueries({ queryKey: ["admin-users"] });
        }}
      />
    </div>
  );
}

// ── Detail drawer ────────────────────────────────────────────────────────────
function UserDrawer({
  userId, onClose, onChanged, onDeleted,
}: {
  userId: string | null;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [planChoice, setPlanChoice] = useState("");
  const [trialDays, setTrialDays] = useState(14);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery<UserDetail>({
    queryKey: ["admin-user", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!userId,
  });

  useEffect(() => { setConfirmDelete(false); setPlanChoice(data?.subscription?.plan ?? ""); }, [data?.subscription?.plan, userId]);

  const runAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!userId) return;
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/users/${userId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Action failed");
      toast.success(body.message || "Done");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const deleteUser = async () => {
    if (!userId) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Delete failed");
      toast.success("User deleted");
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  const u = data?.user;

  return (
    <Sheet open={!!userId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
          <SheetTitle className="text-base font-bold text-[#191c1e]">User details</SheetTitle>
        </SheetHeader>

        {isLoading || !u ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Identity */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold text-white">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[#191c1e] truncate">{u.name}</p>
                <p className="text-sm text-[#64748b] truncate">{u.email}</p>
              </div>
              <div className="ml-auto">
                {u.emailVerified
                  ? <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Verified</Badge>
                  : <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Pending</Badge>}
              </div>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Meta label="Joined" value={fmtDate(u.createdAt)} />
              <Meta label="Language" value={(u.language ?? "—").toUpperCase()} />
              <Meta label="Auth" value={data!.providers.join(", ") || "—"} />
              <Meta label="Orgs" value={data!.memberships.length ? data!.memberships.map((m) => `${m.orgName} (${m.role})`).join(", ") : "—"} />
            </div>

            {/* Subscription */}
            <Section title="Subscription">
              {data!.subscription ? (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <Meta label="Plan" value={<PlanTag plan={data!.subscription.plan} />} />
                  <Meta label="Status" value={<StatusTag status={data!.subscription.status} />} />
                  <Meta label="Trial ends" value={fmtDate(data!.subscription.trialEnd)} />
                  <Meta label="Renews" value={fmtDate(data!.subscription.currentPeriodEnd)} />
                </div>
              ) : <p className="text-xs text-slate-400">No subscription (free tier)</p>}
            </Section>

            {/* Usage this month */}
            <Section title="Usage · this month">
              {data!.usage.length ? (
                <div className="flex flex-wrap gap-2">
                  {data!.usage.map((f) => (
                    <span key={f.feature} className="text-[11px] bg-slate-50 border border-slate-100 rounded-md px-2 py-1 text-slate-600">
                      {f.feature} <span className="font-bold text-slate-900">{f.total}</span>
                    </span>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400">No usage recorded this month</p>}
            </Section>

            {/* Sessions */}
            <Section title={`Sessions (${data!.sessions.length})`}>
              {data!.sessions.length ? (
                <div className="space-y-2">
                  {data!.sessions.slice(0, 5).map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-[11px] text-slate-600">
                      <Globe size={12} className="text-slate-400 shrink-0" />
                      <span className="font-mono">{s.ipAddress ?? "—"}</span>
                      <Monitor size={12} className="text-slate-400 shrink-0 ml-1" />
                      <span className="truncate flex-1">{(s.userAgent ?? "—").slice(0, 40)}</span>
                      <span className="text-slate-400 shrink-0">{timeAgo(s.updatedAt)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400">No active sessions</p>}
            </Section>

            {/* Recent activity */}
            <Section title="Recent activity">
              {data!.activity.length ? (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {data!.activity.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-[11px] text-slate-600">
                      <span className="capitalize">{a.entityType}</span>
                      <span className="font-semibold text-blue-600">{a.action}</span>
                      <span className="ml-auto text-slate-400">{timeAgo(a.createdAt)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400">No activity yet</p>}
            </Section>

            {/* Actions */}
            <Section title="Actions">
              <div className="space-y-3">
                {!u.emailVerified && (
                  <div className="flex gap-2">
                    <ActionBtn icon={MailCheck} label="Resend verification" busy={busy === "resend_verification"} onClick={() => runAction("resend_verification")} />
                    <ActionBtn icon={ShieldCheck} label="Force verify" busy={busy === "force_verify"} onClick={() => runAction("force_verify")} />
                  </div>
                )}
                <ActionBtn icon={RevokeIcon} label="Revoke all sessions" busy={busy === "revoke_sessions"} onClick={() => runAction("revoke_sessions")} />

                {/* Comp / change plan */}
                <div className="flex items-center gap-2">
                  <select value={planChoice} onChange={(e) => setPlanChoice(e.target.value)}
                    className="h-9 flex-1 rounded-md border border-[#e2e8f0] bg-white px-3 text-sm outline-none focus:border-blue-400">
                    <option value="">Select plan…</option>
                    {PLANS.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
                  </select>
                  <Button size="sm" variant="outline" className="border-[#e2e8f0]"
                    disabled={!planChoice || busy === "set_plan"}
                    onClick={() => runAction("set_plan", { plan: planChoice })}>
                    {busy === "set_plan" ? <Loader2 size={14} className="animate-spin" /> : "Comp plan"}
                  </Button>
                </div>

                {/* Extend trial */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <Rocket size={14} className="text-cyan-500" />
                    <Input type="number" min={1} max={90} value={trialDays}
                      onChange={(e) => setTrialDays(Number(e.target.value))}
                      className="h-9 w-20 border-[#e2e8f0]" />
                    <span className="text-xs text-slate-500">days</span>
                  </div>
                  <Button size="sm" variant="outline" className="border-[#e2e8f0]"
                    disabled={busy === "extend_trial"}
                    onClick={() => runAction("extend_trial", { days: trialDays })}>
                    {busy === "extend_trial" ? <Loader2 size={14} className="animate-spin" /> : "Extend trial"}
                  </Button>
                </div>

                {/* Delete (two-click confirm) */}
                <div className="pt-3 border-t border-slate-100">
                  {confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="flex-1 border-slate-200" onClick={() => setConfirmDelete(false)}>
                        <X size={14} className="mr-1" /> Cancel
                      </Button>
                      <Button size="sm" className="flex-1 bg-rose-600 hover:bg-rose-700 text-white" disabled={busy === "delete"} onClick={deleteUser}>
                        {busy === "delete" ? <Loader2 size={14} className="animate-spin mr-1" /> : <Trash2 size={14} className="mr-1" />}
                        Confirm delete
                      </Button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-2 text-xs font-semibold text-rose-600 hover:text-rose-700">
                      <Trash2 size={14} /> Delete this user permanently
                    </button>
                  )}
                </div>
              </div>
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{title}</p>
      {children}
    </div>
  );
}
function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <div className="text-slate-800 font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
function ActionBtn({ icon: Icon, label, busy, onClick }: { icon: React.FC<{ size?: number; className?: string }>; label: string; busy: boolean; onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" className="border-[#e2e8f0] gap-1.5 flex-1" disabled={busy} onClick={onClick}>
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />} {label}
    </Button>
  );
}
