"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search, ChevronLeft, ChevronRight, ShieldCheck, MailCheck, LogOut as RevokeIcon,
  Trash2, X, Globe, Monitor,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  INK, HAIR, MUTE, POS, PLAN_COLOR, SUBSTATUS_COLOR,
  ConsoleShell, StatusHeader, Panel, ConsoleTable, Tag, ActionButton, EmptyLine,
  rowClass, rowStyle, ago, fmtDate, num,
} from "./console";

const PLANS = ["free", "starter", "professional", "enterprise"];
const selectClass = "h-8 rounded-lg border bg-white px-3 font-mono text-[11px] text-slate-700 outline-none focus:border-slate-400";

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
  const [selected, setSelected] = useState<string | null>(() => focusId);

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
    <ConsoleShell>
      <StatusHeader tone="neutral" eyebrow={`${num(total)} users`} title="User management" />

      {/* Filters */}
      <Panel title="Directory" right={
        <div className="flex items-center gap-2">
          <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} className={selectClass} style={{ borderColor: HAIR }}>
            <option value="">all plans</option>
            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={verified} onChange={(e) => { setVerified(e.target.value); setPage(1); }} className={selectClass} style={{ borderColor: HAIR }}>
            <option value="">any status</option>
            <option value="true">verified</option>
            <option value="false">pending</option>
          </select>
        </div>
      }>
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search name or email…"
            className="h-9 w-full rounded-lg border bg-white pl-9 pr-3 font-mono text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
            style={{ borderColor: HAIR }} />
        </div>

        {isError ? (
          <div className="py-8 text-center"><EmptyLine>couldn&apos;t load users. <button className="underline" onClick={() => refetch()}>retry</button></EmptyLine></div>
        ) : (
          <ConsoleTable head={["user", "plan", "status", "verified", "lang", "joined"]}>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b" style={rowStyle}>
                  {Array.from({ length: 6 }).map((__, j) => <td key={j} className="py-3"><Skeleton className="h-4 w-16" /></td>)}
                </tr>
              ))
            ) : (data?.users.length ?? 0) === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center"><EmptyLine>no users match these filters.</EmptyLine></td></tr>
            ) : (
              data!.users.map((u) => (
                <tr key={u.id} onClick={() => setSelected(u.id)} className={`cursor-pointer ${rowClass}`} style={rowStyle}>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 items-center justify-center rounded-md font-mono text-[11px] font-bold text-white" style={{ background: INK }}>
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold" style={{ color: INK }}>{u.name}</p>
                        <p className="font-mono text-[11px] text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5"><Tag color={PLAN_COLOR[u.plan ?? "free"] ?? MUTE}>{u.plan ?? "free"}</Tag></td>
                  <td className="py-2.5">{u.status ? <Tag color={SUBSTATUS_COLOR[u.status] ?? MUTE}>{u.status.replace("_", " ")}</Tag> : <span className="font-mono text-[11px] text-slate-300">—</span>}</td>
                  <td className="py-2.5"><span className="font-mono text-[10px] font-bold uppercase" style={{ color: u.emailVerified ? POS : MUTE }}>{u.emailVerified ? "verified" : "pending"}</span></td>
                  <td className="py-2.5 font-mono text-[11px] uppercase text-slate-400">{u.language ?? "—"}</td>
                  <td className="py-2.5 text-right font-mono text-[11px] tabular-nums text-slate-400">{ago(u.createdAt)} ago</td>
                </tr>
              ))
            )}
          </ConsoleTable>
        )}

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-[11px] text-slate-400">showing {from}–{to} / {num(total)}</span>
          <div className="flex items-center gap-2">
            <ActionButton onClick={() => setPage((p) => p - 1)} disabled={page <= 1}><ChevronLeft size={13} /> prev</ActionButton>
            <span className="font-mono text-[11px] tabular-nums text-slate-500">{page}/{totalPages}</span>
            <ActionButton onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>next <ChevronRight size={13} /></ActionButton>
          </div>
        </div>
      </Panel>

      <UserDrawer
        userId={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["admin-users"] });
          if (selected) qc.invalidateQueries({ queryKey: ["admin-user", selected] });
        }}
        onDeleted={() => { setSelected(null); qc.invalidateQueries({ queryKey: ["admin-users"] }); }}
      />
    </ConsoleShell>
  );
}

/* ── Detail drawer ───────────────────────────────────────────────────────── */
function UserDrawer({ userId, onClose, onChanged, onDeleted }: {
  userId: string | null; onClose: () => void; onChanged: () => void; onDeleted: () => void;
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
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Action failed");
      toast.success(body.message || "Done");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(null); }
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
    } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
    finally { setBusy(null); }
  };

  const u = data?.user;

  return (
    <Sheet open={!!userId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-lg" style={{ background: "#FFFFFF" }}>
        <SheetHeader className="border-b px-6 pb-4 pt-6" style={{ borderColor: HAIR }}>
          <SheetTitle className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-600">User record</SheetTitle>
        </SheetHeader>

        {isLoading || !u ? (
          <div className="space-y-4 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : (
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-lg text-lg font-black text-white" style={{ background: INK }}>{u.name.charAt(0).toUpperCase()}</span>
              <div className="min-w-0">
                <p className="font-bold" style={{ color: INK }}>{u.name}</p>
                <p className="font-mono text-[12px] text-slate-500">{u.email}</p>
              </div>
              <span className="ml-auto font-mono text-[10px] font-bold uppercase" style={{ color: u.emailVerified ? POS : "#B45309" }}>{u.emailVerified ? "verified" : "pending"}</span>
            </div>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border" style={{ background: HAIR, borderColor: HAIR }}>
              <Meta label="joined" value={fmtDate(u.createdAt)} />
              <Meta label="language" value={(u.language ?? "—").toUpperCase()} />
              <Meta label="auth" value={data!.providers.join(", ") || "—"} />
              <Meta label="orgs" value={data!.memberships.length ? data!.memberships.map((m) => `${m.orgName} (${m.role})`).join(", ") : "—"} />
            </div>

            <Section title="Subscription">
              {data!.subscription ? (
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border" style={{ background: HAIR, borderColor: HAIR }}>
                  <Meta label="plan" value={<Tag color={PLAN_COLOR[data!.subscription.plan] ?? MUTE}>{data!.subscription.plan}</Tag>} />
                  <Meta label="status" value={<Tag color={SUBSTATUS_COLOR[data!.subscription.status] ?? MUTE}>{data!.subscription.status.replace("_", " ")}</Tag>} />
                  <Meta label="trial ends" value={fmtDate(data!.subscription.trialEnd)} />
                  <Meta label="renews" value={fmtDate(data!.subscription.currentPeriodEnd)} />
                </div>
              ) : <EmptyLine>no subscription — free tier.</EmptyLine>}
            </Section>

            <Section title="Usage · this month">
              {data!.usage.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {data!.usage.map((f) => (
                    <span key={f.feature} className="rounded-md border px-2 py-1 font-mono text-[10px] text-slate-600" style={{ borderColor: HAIR }}>
                      {f.feature} <span className="font-bold" style={{ color: INK }}>{f.total}</span>
                    </span>
                  ))}
                </div>
              ) : <EmptyLine>no usage recorded this month.</EmptyLine>}
            </Section>

            <Section title={`Sessions · ${data!.sessions.length}`}>
              {data!.sessions.length ? (
                <div className="space-y-2">
                  {data!.sessions.slice(0, 5).map((s) => (
                    <div key={s.id} className="flex items-center gap-2 font-mono text-[11px] text-slate-600">
                      <Globe size={12} className="shrink-0 text-slate-400" /><span>{s.ipAddress ?? "—"}</span>
                      <Monitor size={12} className="ml-1 shrink-0 text-slate-400" /><span className="flex-1 truncate">{(s.userAgent ?? "—").slice(0, 38)}</span>
                      <span className="shrink-0 text-slate-400">{ago(s.updatedAt)}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyLine>no active sessions.</EmptyLine>}
            </Section>

            <Section title="Recent activity">
              {data!.activity.length ? (
                <div className="max-h-40 space-y-1.5 overflow-y-auto">
                  {data!.activity.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 font-mono text-[11px] text-slate-600">
                      <span>{a.entityType}</span><span className="font-bold" style={{ color: "#0891B2" }}>{a.action}</span>
                      <span className="ml-auto text-slate-400">{ago(a.createdAt)}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyLine>no activity yet.</EmptyLine>}
            </Section>

            <Section title="Actions">
              <div className="space-y-3">
                {!u.emailVerified && (
                  <div className="flex gap-2">
                    <div className="flex-1"><ActionButton onClick={() => runAction("resend_verification")} busy={busy === "resend_verification"}><MailCheck size={13} /> resend verify</ActionButton></div>
                    <div className="flex-1"><ActionButton onClick={() => runAction("force_verify")} busy={busy === "force_verify"}><ShieldCheck size={13} /> force verify</ActionButton></div>
                  </div>
                )}
                <ActionButton onClick={() => runAction("revoke_sessions")} busy={busy === "revoke_sessions"}><RevokeIcon size={13} /> revoke all sessions</ActionButton>

                <div className="flex items-center gap-2">
                  <select value={planChoice} onChange={(e) => setPlanChoice(e.target.value)} className={`flex-1 ${selectClass}`} style={{ borderColor: HAIR }}>
                    <option value="">select plan…</option>
                    {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ActionButton onClick={() => runAction("set_plan", { plan: planChoice })} busy={busy === "set_plan"} disabled={!planChoice}>comp plan</ActionButton>
                </div>

                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={90} value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))}
                    className="h-8 w-20 rounded-lg border bg-white px-3 font-mono text-[12px] text-slate-700 outline-none focus:border-slate-400" style={{ borderColor: HAIR }} />
                  <span className="font-mono text-[11px] text-slate-500">days</span>
                  <div className="ml-auto"><ActionButton onClick={() => runAction("extend_trial", { days: trialDays })} busy={busy === "extend_trial"}>extend trial</ActionButton></div>
                </div>

                <div className="border-t pt-3" style={{ borderColor: HAIR }}>
                  {confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><ActionButton onClick={() => setConfirmDelete(false)}><X size={13} /> cancel</ActionButton></div>
                      <div className="flex-1"><ActionButton onClick={deleteUser} busy={busy === "delete"} tone="danger"><Trash2 size={13} /> confirm delete</ActionButton></div>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 font-mono text-[11px] font-bold" style={{ color: "#E11D48" }}>
                      <Trash2 size={13} /> delete this user permanently
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
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">{title}</p>
      {children}
    </div>
  );
}
function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <div className="mt-1 truncate font-mono text-[12px] font-medium" style={{ color: INK }}>{value}</div>
    </div>
  );
}
