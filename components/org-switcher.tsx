"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Building2, ChevronsUpDown, Plus, Check } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
}

interface OrgSwitcherProps {
  collapsed?: boolean;
}

export function OrgSwitcher({ collapsed = false }: OrgSwitcherProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const loadOrgs = useCallback(async () => {
    try {
      const [orgResult, sessionResult] = await Promise.all([
        authClient.organization.list(),
        authClient.getSession(),
      ]);
      const orgList = (orgResult.data ?? []) as Organization[];
      setOrgs(orgList);

      const activeId = sessionResult.data?.session?.activeOrganizationId;
      if (activeId) {
        setActiveOrg(orgList.find((o) => o.id === activeId) ?? null);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  async function switchOrg(org: Organization) {
    if (org.id === activeOrg?.id) return;
    setSwitching(true);

    try {
      await authClient.organization.setActive({ organizationId: org.id });
      setActiveOrg(org);
      queryClient.clear();
      try {
        sessionStorage.removeItem("search-store");
        sessionStorage.removeItem("todo-store");
      } catch {}
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  // Loading state
  if (loading) return null;

  // No orgs at all — shouldn't happen but handle gracefully
  if (orgs.length === 0) return null;

  const hasMultipleOrgs = orgs.length > 1;

  const initials = activeOrg
    ? activeOrg.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const orgAvatar = (size: "sm" | "md" = "md") => {
    const sizeClass = size === "sm" ? "size-6" : "size-8";
    const textSize = size === "sm" ? "text-[9px]" : "text-[10px]";

    if (activeOrg?.logo) {
      return <img src={activeOrg.logo} alt={activeOrg.name} className={cn(sizeClass, "rounded-md object-cover")} />;
    }
    return (
      <div className={cn(sizeClass, "rounded-md bg-gradient-to-br from-blue-500/20 to-cyan-400/20 border border-white/[0.06] flex items-center justify-center font-bold text-blue-400", textSize)}>
        {initials}
      </div>
    );
  };

  // Single org — just show the workspace name, no dropdown
  if (!hasMultipleOrgs) {
    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger className="w-full flex justify-center">
            {orgAvatar("sm")}
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {activeOrg?.name ?? "Workspace"}
          </TooltipContent>
        </Tooltip>
      );
    }
    return (
      <div className="flex items-center gap-3 px-2 py-1">
        {orgAvatar()}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Workspace</p>
          <p className="text-sm font-semibold text-slate-200 truncate">{activeOrg?.name}</p>
        </div>
      </div>
    );
  }

  // Multiple orgs — show dropdown
  if (collapsed) {
    return (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger className="w-full">
            <DropdownMenuTrigger className="w-10 h-10 mx-auto flex items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer">
              {orgAvatar("sm")}
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {activeOrg?.name ?? "Switch workspace"}
          </TooltipContent>
        </Tooltip>
        <OrgDropdownContent
          orgs={orgs}
          activeOrg={activeOrg}
          onSwitch={switchOrg}
          switching={switching}
        />
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(
        "w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer text-left",
        switching && "opacity-50 pointer-events-none"
      )}>
        {orgAvatar()}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Workspace</p>
          <p className="text-sm font-semibold text-slate-200 truncate">{activeOrg?.name ?? "Select workspace"}</p>
        </div>
        <ChevronsUpDown className="size-3.5 text-slate-500 shrink-0" />
      </DropdownMenuTrigger>
      <OrgDropdownContent
        orgs={orgs}
        activeOrg={activeOrg}
        onSwitch={switchOrg}
        switching={switching}
      />
    </DropdownMenu>
  );
}

function OrgDropdownContent({
  orgs,
  activeOrg,
  onSwitch,
  switching,
}: {
  orgs: Organization[];
  activeOrg: Organization | null;
  onSwitch: (org: Organization) => void;
  switching: boolean;
}) {
  const router = useRouter();

  return (
    <DropdownMenuContent align="start" sideOffset={4} className="w-[240px]">
      <div className="px-2 py-1.5">
        <p className="text-xs font-medium text-muted-foreground">Workspaces</p>
      </div>
      {orgs.map((org) => {
        const isActive = org.id === activeOrg?.id;
        const orgInitials = org.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

        return (
          <DropdownMenuItem
            key={org.id}
            onClick={() => onSwitch(org)}
            disabled={switching}
            className={cn(
              "flex items-center gap-3 cursor-pointer",
              isActive && "bg-accent"
            )}
          >
            {org.logo ? (
              <img src={org.logo} alt={org.name} className="size-6 rounded-md object-cover" />
            ) : (
              <div className="size-6 rounded-md bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                {orgInitials}
              </div>
            )}
            <span className="flex-1 truncate text-sm">{org.name}</span>
            {isActive && <Check className="size-4 text-blue-500 shrink-0" />}
          </DropdownMenuItem>
        );
      })}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => router.push("/settings/org/general?create=true")}
        className="cursor-pointer"
      >
        <Plus className="size-4 mr-2 text-muted-foreground" />
        <span className="text-sm">Create workspace</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
