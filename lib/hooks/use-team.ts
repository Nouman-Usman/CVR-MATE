"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrgRole = "owner" | "admin" | "member";

export interface OrgMember {
  id: string;
  role: OrgRole;
  createdAt: string;
  userId: string;
  user: { id: string; name: string; email: string; image?: string | null };
}

export interface OrgInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  members?: OrgMember[];
  invitations?: OrgInvitation[];
}

export interface OrganizationData {
  org: Org | null;
  myRole: OrgRole | null;
  isOwner: boolean;
  isAdminOrOwner: boolean;
}

export interface AuditEvent {
  id: string;
  action: string;
  actorName: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

async function fetchOrg(
  userId: string | undefined,
  activeOrganizationId: string | null | undefined
): Promise<OrganizationData> {
  if (!userId) return { org: null, myRole: null, isOwner: false, isAdminOrOwner: false };

  const orgsRes = await fetch("/api/auth/organization/list", {
    method: "GET",
    credentials: "include",
  });
  if (!orgsRes.ok) return { org: null, myRole: null, isOwner: false, isAdminOrOwner: false };

  const orgs = await orgsRes.json();
  if (!Array.isArray(orgs) || orgs.length === 0) {
    return { org: null, myRole: null, isOwner: false, isAdminOrOwner: false };
  }

  /**
   * Show the org the session is actually in, not `orgs[0]`.
   *
   * Picking the first one is the client-side twin of the auto-discovery that
   * was just removed from `validateActiveOrg`: with more than one membership,
   * this screen managed a different organization than the API was writing to.
   */
  const activeOrgId = activeOrganizationId ?? null;
  const target = orgs.find((o: { id: string }) => o.id === activeOrgId);
  // No active org means the personal workspace — there is no team to show.
  if (!target) {
    return { org: null, myRole: null, isOwner: false, isAdminOrOwner: false };
  }

  const fullRes = await fetch(
    `/api/auth/organization/get-full-organization?organizationId=${target.id}`,
    { method: "GET", credentials: "include" }
  );
  if (!fullRes.ok) return { org: null, myRole: null, isOwner: false, isAdminOrOwner: false };

  const org: Org = await fullRes.json();
  const myMember = org.members?.find((m) => m.userId === userId);
  const myRole = (myMember?.role as OrgRole) ?? null;

  return {
    org,
    myRole,
    isOwner: myRole === "owner",
    isAdminOrOwner: myRole === "owner" || myRole === "admin",
  };
}

// ─── Query Hooks ──────────────────────────────────────────────────────────────

export function useOrganization(
  userId: string | undefined,
  activeOrganizationId?: string | null
) {
  return useQuery<OrganizationData>({
    // The active org is part of the key: switching workspaces must not serve
    // the previous org's members and invitations from cache.
    queryKey: ["organization", userId, activeOrganizationId ?? "personal"],
    queryFn: () => fetchOrg(userId, activeOrganizationId),
    staleTime: 30_000,
    enabled: !!userId,
  });
}

export function useAuditLog(orgId: string | null, isAdminOrOwner: boolean) {
  return useQuery<{ events: AuditEvent[] }>({
    queryKey: ["team-audit-log", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/team/${orgId}/audit-log`, { credentials: "include" });
      return apiJson(res);
    },
    staleTime: 60_000,
    enabled: !!orgId && isAdminOrOwner,
  });
}

/**
 * The organization's issuer identity — what appears as the seller on quotes
 * and orders. Readable by any member; only owners/admins may change it.
 */
export interface OrgProfile {
  id: string;
  organizationId: string;
  legalName: string;
  cvr: string | null;
  addressLine: string | null;
  zipCode: string | null;
  city: string | null;
  countryCode: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  brandColor: string | null;
  /** Whether these values came from the CVR registry or were typed by hand. */
  source: "cvr" | "manual";
  cvrVerifiedAt: string | null;
}

export function useOrgProfile(orgId: string | null) {
  return useQuery<{ profile: OrgProfile | null }>({
    queryKey: ["organization-profile", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/team/${orgId}/profile`, { credentials: "include" });
      return apiJson(res);
    },
    staleTime: 60_000,
    enabled: !!orgId,
  });
}

// ─── Mutation Hooks ───────────────────────────────────────────────────────────

function useTeamMutation<TVariables = void>(
  mutationFn: (vars: TVariables) => Promise<unknown>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
    },
  });
}

/**
 * The company identity an org issues documents under. Required at creation:
 * it becomes the seller block on every quote and order, and an org without one
 * sends documents with no address — which is what happened before this existed.
 */
export interface OrgProfileInput {
  legalName: string;
  cvr?: string;
  addressLine: string;
  zipCode?: string;
  city?: string;
  countryCode?: string;
  email?: string;
  phone?: string;
  website?: string;
  brandColor?: string;
  /** Claim only; the server re-checks it against the registry before trusting it. */
  source: "cvr" | "manual";
}

export function useCreateOrg() {
  return useTeamMutation(
    async (vars: { name: string; slug?: string; profile: OrgProfileInput }) => {
      const res = await fetch("/api/team/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(vars),
      });
      const data = await apiJson<{ id: string }>(res);
      if (data.id) {
        authClient.organization.setActive({ organizationId: data.id }).catch(() => {});
      }
      return data;
    }
  );
}

export function useInviteMember() {
  return useTeamMutation(
    async ({ email, role, organizationId }: { email: string; role: string; organizationId: string }) => {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, role, organizationId }),
      });
      return apiJson(res);
    }
  );
}

/**
 * Send an existing invitation again and push its expiry out.
 *
 * Returns `emailed` so the caller can tell a delivered invitation from one that
 * only exists as a link — a silent failure here is what produced invitations
 * nobody could act on.
 */
export function useResendInvitation() {
  return useTeamMutation(async (invitationId: string) => {
    const res = await fetch(`/api/team/invitations/${invitationId}/resend`, {
      method: "POST",
      credentials: "include",
    });
    return apiJson<{ ok: boolean; emailed: boolean; emailError?: string; inviteUrl: string }>(res);
  });
}

export function useCancelInvitation() {
  return useTeamMutation(async (invId: string) => {
    const res = await fetch(`/api/team/invitations/${invId}`, {
      method: "DELETE",
      credentials: "include",
    });
    return apiJson(res);
  });
}

export function useRemoveMember() {
  return useTeamMutation(async (memberId: string) => {
    const res = await fetch(`/api/team/members/${memberId}`, {
      method: "DELETE",
      credentials: "include",
    });
    return apiJson(res);
  });
}

export function useChangeRole() {
  return useTeamMutation(
    async ({ memberId, role }: { memberId: string; role: string }) => {
      const res = await fetch(`/api/team/members/${memberId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      return apiJson(res);
    }
  );
}

export function useLeaveOrg() {
  return useTeamMutation(async (organizationId: string) => {
    const res = await fetch("/api/team/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ organizationId }),
    });
    return apiJson(res);
  });
}

export function useTransferOwnership() {
  return useTeamMutation(
    async ({ organizationId, newOwnerId }: { organizationId: string; newOwnerId: string }) => {
      const res = await fetch("/api/team/transfer-ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ organizationId, newOwnerId }),
      });
      return apiJson(res);
    }
  );
}

export function useRenameOrg() {
  return useTeamMutation(
    async ({ orgId, name }: { orgId: string; name: string }) => {
      const res = await fetch(`/api/team/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      return apiJson(res);
    }
  );
}

/**
 * Profile mutations get their own invalidation.
 *
 * `useTeamMutation` refreshes the `organization` query, which does not carry
 * the profile — using it here would leave the form showing the values the user
 * just replaced.
 */
function useOrgProfileMutation<TVariables extends { orgId: string }>(
  mutationFn: (vars: TVariables) => Promise<unknown>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["organization-profile", vars.orgId] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
    },
  });
}

export function useUpdateOrgProfile() {
  return useOrgProfileMutation(
    async ({ orgId, patch }: { orgId: string; patch: Partial<OrgProfile> }) => {
      const res = await fetch(`/api/team/${orgId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      return apiJson(res);
    }
  );
}

/**
 * Re-read the profile from the CVR registry, overwriting the registered fields
 * and restoring `source: "cvr"`. This is how a company that has relocated gets
 * picked up — a hand-edit deliberately drops the verified flag, and this is how
 * it is earned back.
 */
export function useVerifyOrgProfile() {
  return useOrgProfileMutation(async ({ orgId }: { orgId: string }) => {
    const res = await fetch(`/api/team/${orgId}/profile`, {
      method: "POST",
      credentials: "include",
    });
    return apiJson(res);
  });
}

export function useDeleteOrg() {
  return useTeamMutation(async (orgId: string) => {
    const res = await fetch(`/api/team/${orgId}`, {
      method: "DELETE",
      credentials: "include",
    });
    // Surface the blocked-deletion detail (409 with resource counts)
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to delete organization");
    return data;
  });
}
