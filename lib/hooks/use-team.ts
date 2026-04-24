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

async function fetchOrg(userId: string | undefined): Promise<OrganizationData> {
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

  const fullRes = await fetch(
    `/api/auth/organization/get-full-organization?organizationId=${orgs[0].id}`,
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

export function useOrganization(userId: string | undefined) {
  return useQuery<OrganizationData>({
    queryKey: ["organization", userId],
    queryFn: () => fetchOrg(userId),
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

export function useCreateOrg() {
  return useTeamMutation(async (name: string) => {
    const res = await fetch("/api/team/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    });
    const data = await apiJson<{ id: string }>(res);
    if (data.id) {
      authClient.organization.setActive({ organizationId: data.id }).catch(() => {});
    }
    return data;
  });
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
