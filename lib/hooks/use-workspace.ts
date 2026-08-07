"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

import { useSession } from "@/lib/auth-client";

/**
 * Which workspace the user is in, and how to move between them.
 *
 * Personal is a real destination, not the absence of one: Better Auth's
 * `setActive({ organizationId: null })` clears the session's active org and
 * re-issues the cookie, so "no organization" is a state you can deliberately
 * choose rather than one you fall into.
 */

export interface WorkspaceOption {
  id: string;
  name: string;
  slug?: string;
}

async function fetchOrganizations(): Promise<WorkspaceOption[]> {
  const res = await fetch("/api/auth/organization/list", { credentials: "include" });
  if (!res.ok) return [];
  const orgs = await res.json();
  return Array.isArray(orgs) ? orgs : [];
}

export function useWorkspaces() {
  const { data: session } = useSession();
  // The session is the source of truth for which workspace we are in. The
  // resolved `activeOrg` below is derived and can briefly be null while the
  // org list refetches, so comparisons must use this, not that.
  const activeOrgId = session?.session?.activeOrganizationId ?? null;

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ["workspace-list"],
    queryFn: fetchOrganizations,
    staleTime: 60_000,
    enabled: !!session?.user?.id,
  });

  // A session can name an org the user has since been removed from. The server
  // resolves that to personal, so the UI must agree rather than showing a
  // workspace the API will not honour.
  const activeOrg = organizations.find((o) => o.id === activeOrgId) ?? null;

  return {
    isLoading,
    organizations,
    activeOrgId,
    activeOrg,
    isPersonal: !activeOrg,
    hasOrganizations: organizations.length > 0,
  };
}

export function useSwitchWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organizationId: string | null) => {
      /**
       * The REST endpoint directly, rather than
       * `authClient.organization.setActive({ organizationId: null })`.
       *
       * The SDK issues no request at all for a null value — verified by network
       * capture — so switching to Personal silently did nothing while the UI
       * appeared to succeed. The route itself handles null correctly: it clears
       * the session's active organization and re-issues the cookie.
       */
      const res = await fetch("/api/auth/organization/set-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error("Could not switch workspace");
    },
    onSuccess: () => {
      /**
       * Full reload rather than cache invalidation.
       *
       * The switch changes a cookie that every server request reads, and the
       * auth client keeps its own session store. Reloading is the only way to
       * guarantee nothing anywhere is still holding the previous workspace —
       * and showing the previous workspace's rows for even one frame is the
       * exact leak this feature exists to remove. Switching is a deliberate,
       * infrequent act where a reload reads as confirmation, not friction.
       */
      queryClient.clear();
      window.location.reload();
    },
  });
}
