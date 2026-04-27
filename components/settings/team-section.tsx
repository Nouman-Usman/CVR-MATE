"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useLanguage } from "@/lib/i18n/language-context";
import { useSubscription } from "@/lib/hooks/use-subscription";
import {
  useOrganization,
  useAuditLog,
  useCreateOrg,
  useInviteMember,
  useCancelInvitation,
  useRemoveMember,
  useChangeRole,
  useLeaveOrg,
  useTransferOwnership,
  useRenameOrg,
  useDeleteOrg,
  type OrgMember,
} from "@/lib/hooks/use-team";
import { Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { COMING_SOON_FEATURES } from "@/lib/constants";
import { ComingSoonOverlay } from "@/components/ui/coming-soon";

// ─── Small helpers ────────────────────────────────────────────────────────────

function initials(nameOrEmail: string) {
  return nameOrEmail
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function timeAgo(dateStr: string, locale: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return locale === "da" ? "lige nu" : "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return locale === "da" ? `${mins}m siden` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return locale === "da" ? `${hrs}t siden` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return locale === "da" ? `${days}d siden` : `${days}d ago`;
}

function auditActionLabel(action: string, locale: string): string {
  const labels: Record<string, [string, string]> = {
    org_created: ["Organization created", "Organisation oprettet"],
    org_renamed: ["Organization renamed", "Organisation omdøbt"],
    org_deleted: ["Organization deleted", "Organisation slettet"],
    member_invited: ["Member invited", "Medlem inviteret"],
    invitation_accepted: ["Invitation accepted", "Invitation accepteret"],
    invitation_declined: ["Invitation declined", "Invitation afvist"],
    invite_revoked: ["Invitation revoked", "Invitation annulleret"],
    member_removed: ["Member removed", "Medlem fjernet"],
    member_left: ["Member left", "Medlem forlod"],
    role_changed: ["Role changed", "Rolle ændret"],
    ownership_transferred: ["Ownership transferred", "Ejerskab overført"],
    seat_limit_reached: ["Seat limit reached", "Pladslimit nået"],
    permission_denied: ["Permission denied", "Adgang nægtet"],
  };
  const pair = labels[action];
  if (!pair) return action;
  return locale === "da" ? pair[1] : pair[0];
}

// ─── Inline confirm row ───────────────────────────────────────────────────────

function InlineConfirm({
  onConfirm,
  onCancel,
  loading,
  cancelLabel,
  confirmLabel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  confirmLabel: string;
  cancelLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 animate-in fade-in duration-150">
      <button
        onClick={onConfirm}
        disabled={loading}
        className="px-3 py-1 bg-red-600 text-white text-[11px] font-bold rounded-full hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
      >
        {loading && <Loader2 className="size-3 animate-spin" />}
        {confirmLabel}
      </button>
      <button
        onClick={onCancel}
        className="px-3 py-1 border border-slate-200 text-slate-500 text-[11px] font-medium rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
      >
        {cancelLabel}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TeamSection() {
  const { t, locale } = useLanguage();
  const { data: session } = useSession();
  const st = t.settings.team;
  const { data: subData } = useSubscription();
  const isEnterprise = subData?.plan === "enterprise";

  const userId = session?.user?.id;
  const { data: teamData, isLoading: orgLoading } = useOrganization(userId);
  const org = teamData?.org ?? null;
  const myRole = teamData?.myRole ?? null;
  const isOwner = teamData?.isOwner ?? false;
  const isAdminOrOwner = teamData?.isAdminOrOwner ?? false;

  // Audit log
  const [showAuditLog, setShowAuditLog] = useState(false);
  const { data: auditData, isLoading: auditLoading } = useAuditLog(
    org?.id ?? null,
    isAdminOrOwner
  );

  // Local UI state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [newOrgName, setNewOrgName] = useState("");
  const [editingOrgName, setEditingOrgName] = useState(false);
  const [orgNameDraft, setOrgNameDraft] = useState("");
  const [transferTarget, setTransferTarget] = useState<OrgMember | null>(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteBlockedMsg, setDeleteBlockedMsg] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Mutations
  const createOrg = useCreateOrg();
  const inviteMember = useInviteMember();
  const cancelInvitation = useCancelInvitation();
  const removeMember = useRemoveMember();
  const changeRole = useChangeRole();
  const leaveOrg = useLeaveOrg();
  const transferOwnership = useTransferOwnership();
  const renameOrg = useRenameOrg();
  const deleteOrg = useDeleteOrg();

  const memberCount = org?.members?.length ?? 0;
  const pendingCount =
    org?.invitations?.filter((i) => i.status === "pending").length ?? 0;

  const cardClass =
    "bg-white rounded-2xl shadow-sm border border-slate-100/60 p-4 sm:p-6 md:p-8";
  const inputClass =
    "w-full bg-slate-50 border-none rounded-lg py-3 px-4 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none";
  const btnPrimary =
    "px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-full hover:scale-[1.02] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";

  // ── Coming Soon gate ──────────────────────────────────────────────────────
  if (COMING_SOON_FEATURES.has("team")) {
    return (
      <div className={`${cardClass} relative`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-slate-400 text-xl">groups</span>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{st.title}</h2>
        </div>
        <p className="text-xs text-slate-400 mb-6">{st.subtitle}</p>
        <ComingSoonOverlay
          feature="team"
          description="Team workspaces, role-based access, and audit logging are coming soon."
        />
      </div>
    );
  }

  // ── Plan gate — non-enterprise with no existing org ──────────────────────
  if (!isEnterprise && !org && !orgLoading) {
    return (
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-slate-400 text-xl">groups</span>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{st.title}</h2>
        </div>
        <p className="text-xs text-slate-400 mb-6">{st.subtitle}</p>
        <div className="bg-slate-50 rounded-xl p-6 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">lock</span>
          <p className="text-sm font-semibold text-slate-900 mb-1">
            {locale === "da" ? "Team-funktioner kræver Enterprise" : "Team features require Enterprise"}
          </p>
          <p className="text-xs text-slate-400 mb-4">
            {locale === "da"
              ? "Opgrader til Enterprise for at oprette teams, invitere medlemmer og dele data."
              : "Upgrade to Enterprise to create teams, invite members, and share data."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 ${
            toast.ok ? "bg-foreground text-background" : "bg-destructive text-destructive-foreground"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className={cardClass}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-slate-400 text-xl">groups</span>
          {org && editingOrgName ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                className="text-sm font-bold text-slate-900 uppercase tracking-wider bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20"
                value={orgNameDraft}
                onChange={(e) => setOrgNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    renameOrg.mutate(
                      { orgId: org.id, name: orgNameDraft.trim() },
                      {
                        onSuccess: () => { showToast(locale === "da" ? "Navn opdateret" : "Name updated"); setEditingOrgName(false); },
                        onError: (err) => showToast(err.message, false),
                      }
                    );
                  }
                  if (e.key === "Escape") setEditingOrgName(false);
                }}
                autoFocus
              />
              <button
                onClick={() =>
                  renameOrg.mutate(
                    { orgId: org.id, name: orgNameDraft.trim() },
                    {
                      onSuccess: () => { showToast(locale === "da" ? "Navn opdateret" : "Name updated"); setEditingOrgName(false); },
                      onError: (err) => showToast(err.message, false),
                    }
                  )
                }
                disabled={renameOrg.isPending}
                className="text-blue-600 hover:text-blue-800 text-xs font-bold cursor-pointer"
              >
                {renameOrg.isPending ? <Loader2 className="size-3 animate-spin" /> : (locale === "da" ? "Gem" : "Save")}
              </button>
              <button onClick={() => setEditingOrgName(false)} className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer">
                {locale === "da" ? "Annuller" : "Cancel"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                {org ? org.name : st.title}
              </h2>
              {org && isAdminOrOwner && (
                <button
                  onClick={() => { setOrgNameDraft(org.name); setEditingOrgName(true); }}
                  className="text-slate-300 hover:text-slate-500 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-6">{st.subtitle}</p>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {orgLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 text-slate-300 animate-spin" />
          </div>
        ) : !org ? (
          /* ── No org — create one ─────────────────────────────────────── */
          <div className="bg-slate-50 rounded-xl p-6">
            <div className="flex items-start gap-3 mb-5">
              <span className="material-symbols-outlined text-blue-500 text-2xl shrink-0">group_add</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{st.createOrg}</p>
                <p className="text-xs text-slate-400 mt-0.5">{st.createOrgDesc}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                className={`flex-1 ${inputClass}`}
                placeholder={st.orgNamePlaceholder}
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && newOrgName.trim() && createOrg.mutate(newOrgName.trim(), { onSuccess: () => { showToast(st.created); setNewOrgName(""); }, onError: (err) => showToast(err.message, false) })}
              />
              <button
                onClick={() =>
                  createOrg.mutate(newOrgName.trim(), {
                    onSuccess: () => { showToast(st.created); setNewOrgName(""); },
                    onError: (err) => showToast(err.message, false),
                  })
                }
                disabled={createOrg.isPending || !newOrgName.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-lg hover:scale-[1.02] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center gap-2"
              >
                {createOrg.isPending ? (
                  <><Loader2 className="size-4 animate-spin" />{st.creating}</>
                ) : st.create}
              </button>
            </div>
          </div>
        ) : (
          /* ── Has org ─────────────────────────────────────────────────── */
          <div className="space-y-6">
            {/* Downgrade warning */}
            {!isEnterprise && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-500 text-lg mt-0.5 shrink-0">warning</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {locale === "da" ? "Team-funktioner er begrænset" : "Team features are limited"}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {locale === "da"
                      ? "Din nuværende plan inkluderer ikke team-funktioner. Nye invitationer er blokeret."
                      : "Your current plan does not include team features. New invitations are blocked."}
                  </p>
                </div>
              </div>
            )}

            {/* Seat meter */}
            <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 text-lg">group</span>
                <span className="text-sm font-medium text-slate-700">
                  {memberCount} {locale === "da" ? "aktive" : "active"}
                  {pendingCount > 0 && (
                    <span className="text-slate-400"> &middot; {pendingCount} {locale === "da" ? "ventende" : "pending"}</span>
                  )}
                </span>
              </div>
              <span className={`text-xs font-semibold ${isEnterprise ? "text-emerald-600" : "text-amber-600"}`}>
                {isEnterprise
                  ? `Enterprise — ${locale === "da" ? "Ubegrænsede pladser" : "Unlimited seats"}`
                  : `${subData?.planName ?? "Free"} — ${locale === "da" ? "Opgradering påkrævet" : "Upgrade required"}`}
              </span>
            </div>

            {/* Invite form */}
            {isAdminOrOwner && isEnterprise && (
              <div className="bg-slate-50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-blue-500 text-lg">person_add</span>
                  <p className="text-sm font-semibold text-slate-900">{st.invite}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <span className="material-symbols-outlined text-lg">mail</span>
                    </div>
                    <input
                      className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      type="email"
                      placeholder={st.emailPlaceholder}
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <select
                    className="bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-900 outline-none appearance-none sm:w-32"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="member">{st.member}</option>
                    <option value="admin">{st.admin}</option>
                  </select>
                  <button
                    onClick={() =>
                      inviteMember.mutate(
                        { email: inviteEmail.trim(), role: inviteRole, organizationId: org.id },
                        {
                          onSuccess: () => { showToast(st.sent); setInviteEmail(""); },
                          onError: (err) => showToast(err.message, false),
                        }
                      )
                    }
                    disabled={inviteMember.isPending || !inviteEmail.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-lg hover:scale-[1.02] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center gap-2"
                  >
                    {inviteMember.isPending ? (
                      <><Loader2 className="size-4 animate-spin" />{st.sending}</>
                    ) : (
                      <><span className="material-symbols-outlined text-sm">send</span>{st.send}</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Members list */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">{st.members}</h3>
              {org.members && org.members.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {org.members.map((m) => {
                    const isCurrentUser = m.userId === userId;
                    const isConfirming = confirmingRemove === m.id;
                    return (
                      <div key={m.id} className="flex items-center gap-3 py-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {initials(m.user.name || m.user.email)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {m.user.name || m.user.email}
                            {isCurrentUser && (
                              <span className="text-xs text-slate-400 ml-1.5 font-normal">
                                ({locale === "da" ? "dig" : "you"})
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 truncate">{m.user.email}</p>
                        </div>
                        {/* Role badge or dropdown */}
                        {m.role === "owner" ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 bg-amber-50 text-amber-700">{st.owner}</span>
                        ) : isOwner && !isCurrentUser ? (
                          <select
                            value={m.role}
                            onChange={(e) =>
                              changeRole.mutate(
                                { memberId: m.id, role: e.target.value },
                                { onError: (err) => showToast(err.message, false) }
                              )
                            }
                            disabled={changeRole.isPending}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 outline-none cursor-pointer appearance-none ${
                              m.role === "admin" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                            } ${changeRole.isPending ? "opacity-50" : ""}`}
                          >
                            <option value="member">{st.member}</option>
                            <option value="admin">{st.admin}</option>
                          </select>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            m.role === "admin" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                          }`}>
                            {m.role === "admin" ? st.admin : st.member}
                          </span>
                        )}
                        {/* Remove — inline confirm */}
                        {!isCurrentUser && m.role !== "owner" && isAdminOrOwner && (
                          isConfirming ? (
                            <InlineConfirm
                              onConfirm={() =>
                                removeMember.mutate(m.id, {
                                  onSuccess: () => { showToast(st.removed); setConfirmingRemove(null); },
                                  onError: (err) => { showToast(err.message, false); setConfirmingRemove(null); },
                                })
                              }
                              onCancel={() => setConfirmingRemove(null)}
                              loading={removeMember.isPending}
                              confirmLabel={locale === "da" ? "Fjern" : "Remove"}
                              cancelLabel={locale === "da" ? "Annuller" : "Cancel"}
                            />
                          ) : (
                            <button
                              onClick={() => setConfirmingRemove(m.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors p-1 cursor-pointer shrink-0"
                              title={st.remove}
                            >
                              <X className="size-4" />
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-3">{st.noMembers}</p>
              )}
            </div>

            {/* Pending invitations */}
            {org.invitations && org.invitations.filter((i) => i.status === "pending").length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">{st.pendingInvites}</h3>
                <div className="divide-y divide-slate-100">
                  {org.invitations.filter((i) => i.status === "pending").map((inv) => {
                    const isConfirming = confirmingCancel === inv.id;
                    return (
                      <div key={inv.id} className="flex items-center gap-3 py-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <span className="material-symbols-outlined text-lg">mail</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{inv.email}</p>
                          <p className="text-xs text-slate-400">{inv.role === "admin" ? st.admin : st.member}</p>
                        </div>
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                          {st.pendingStatus}
                        </span>
                        {isAdminOrOwner && (
                          isConfirming ? (
                            <InlineConfirm
                              onConfirm={() =>
                                cancelInvitation.mutate(inv.id, {
                                  onSuccess: () => { showToast(st.cancelled); setConfirmingCancel(null); },
                                  onError: (err) => { showToast(err.message, false); setConfirmingCancel(null); },
                                })
                              }
                              onCancel={() => setConfirmingCancel(null)}
                              loading={cancelInvitation.isPending}
                              confirmLabel={locale === "da" ? "Annuller inv." : "Cancel invite"}
                              cancelLabel={locale === "da" ? "Behold" : "Keep"}
                            />
                          ) : (
                            <button
                              onClick={() => setConfirmingCancel(inv.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors p-1 cursor-pointer shrink-0"
                              title={st.cancel}
                            >
                              <X className="size-4" />
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Danger zone ─────────────────────────────────────────────── */}
            <div className="border-t border-slate-100 pt-5 space-y-5">

              {/* Transfer ownership — owner only */}
              {isOwner && org.members && org.members.filter((m) => m.role !== "owner").length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">{st.transferOwnership}</h3>
                  <p className="text-xs text-slate-400 mb-3">{st.transferDesc}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-900 outline-none appearance-none"
                      value={transferTarget?.id ?? ""}
                      onChange={(e) => {
                        const m = org.members?.find((m) => m.id === e.target.value);
                        setTransferTarget(m ?? null);
                        setShowTransferConfirm(false);
                      }}
                    >
                      <option value="">{st.selectMember}</option>
                      {org.members.filter((m) => m.role !== "owner").map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.user.name || m.user.email} ({m.role})
                        </option>
                      ))}
                    </select>
                    {transferTarget && !showTransferConfirm && (
                      <button
                        onClick={() => setShowTransferConfirm(true)}
                        className="px-4 py-2 bg-amber-50 text-amber-700 font-bold text-xs rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        {st.transfer}
                      </button>
                    )}
                  </div>
                  {showTransferConfirm && transferTarget && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-3">
                      <p className="text-sm text-amber-800 font-semibold mb-1">{st.transferConfirm}</p>
                      <p className="text-xs text-amber-700 mb-3">
                        {st.transferConfirmBody.replace("{name}", transferTarget.user.name || transferTarget.user.email)}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            transferOwnership.mutate(
                              { organizationId: org.id, newOwnerId: transferTarget.userId },
                              {
                                onSuccess: () => {
                                  showToast(st.transferred);
                                  setShowTransferConfirm(false);
                                  setTransferTarget(null);
                                },
                                onError: (err) => showToast(err.message, false),
                              }
                            )
                          }
                          disabled={transferOwnership.isPending}
                          className="px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-full hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          {transferOwnership.isPending && <Loader2 className="size-3 animate-spin" />}
                          {transferOwnership.isPending ? st.transferring : st.transferConfirm}
                        </button>
                        <button
                          onClick={() => { setShowTransferConfirm(false); setTransferTarget(null); }}
                          className="px-4 py-2 border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          {locale === "da" ? "Annuller" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Leave org — non-owners */}
              {!isOwner && myRole && (
                <div>
                  <button
                    onClick={() =>
                      leaveOrg.mutate(org.id, {
                        onSuccess: () => showToast(locale === "da" ? "Du har forladt teamet" : "You left the team"),
                        onError: (err) => showToast(err.message, false),
                      })
                    }
                    disabled={leaveOrg.isPending}
                    className="px-4 py-2 border-2 border-red-200 text-red-500 font-bold text-xs rounded-full hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {leaveOrg.isPending && <Loader2 className="size-3 animate-spin" />}
                    {leaveOrg.isPending ? st.leaving : st.leaveOrg}
                  </button>
                  <p className="text-xs text-slate-400 mt-1.5">{st.leaveOrgDesc}</p>
                </div>
              )}

              {/* Delete org — owner only */}
              {isOwner && (
                <div>
                  <button
                    onClick={() => { setShowDeleteModal(true); setDeleteBlockedMsg(null); }}
                    className="px-4 py-2 border-2 border-red-500 text-red-600 font-bold text-xs rounded-full hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                  >
                    {st.deleteOrg}
                  </button>
                  {showDeleteModal && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 mt-3">
                      <h3 className="text-sm font-bold text-red-800 mb-1">{st.deleteOrgTitle}</h3>
                      <p className="text-xs text-red-600 mb-3">
                        {st.deleteOrgBody.replace("{orgName}", org.name)}
                      </p>
                      {deleteBlockedMsg && (
                        <div className="bg-red-100 border border-red-300 rounded-lg px-3 py-2 text-xs text-red-700 mb-3">
                          {deleteBlockedMsg}
                        </div>
                      )}
                      <input
                        className="w-full bg-white border border-red-200 rounded-lg py-2 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-red-500/20 mb-3"
                        placeholder={org.name}
                        value={deleteConfirmName}
                        onChange={(e) => { setDeleteConfirmName(e.target.value); setDeleteBlockedMsg(null); }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            deleteOrg.mutate(org.id, {
                              onSuccess: () => {
                                showToast(locale === "da" ? "Organisation slettet" : "Organization deleted");
                                setShowDeleteModal(false);
                                setDeleteConfirmName("");
                              },
                              onError: (err) => {
                                // Show blocked-deletion detail inline instead of a toast
                                setDeleteBlockedMsg(err.message);
                              },
                            })
                          }
                          disabled={deleteOrg.isPending || deleteConfirmName !== org.name}
                          className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-full hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          {deleteOrg.isPending && <Loader2 className="size-3 animate-spin" />}
                          {deleteOrg.isPending ? st.deleting : st.deletePermanently}
                        </button>
                        <button
                          onClick={() => { setShowDeleteModal(false); setDeleteConfirmName(""); setDeleteBlockedMsg(null); }}
                          className="px-4 py-2 border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          {locale === "da" ? "Annuller" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Audit log (owner/admin) ──────────────────────────────────── */}
            {isAdminOrOwner && (
              <div className="border-t border-slate-100 pt-5">
                <button
                  onClick={() => setShowAuditLog((v) => !v)}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showAuditLog ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  {showAuditLog ? st.hideAuditLog : st.showAuditLog}
                </button>

                {showAuditLog && (
                  <div className="mt-3">
                    {auditLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="size-5 text-slate-300 animate-spin" />
                      </div>
                    ) : !auditData?.events?.length ? (
                      <p className="text-xs text-slate-400 py-4 text-center">{st.auditLogEmpty}</p>
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto rounded-xl border border-slate-100">
                        {auditData.events.map((ev) => (
                          <div key={ev.id} className="flex items-start gap-3 px-4 py-3">
                            <span className="material-symbols-outlined text-slate-300 text-base mt-0.5 shrink-0">history</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-700">{auditActionLabel(ev.action, locale)}</p>
                              {ev.actorName && (
                                <p className="text-[11px] text-slate-400 truncate">{ev.actorName}</p>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
                              {timeAgo(ev.createdAt, locale)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
