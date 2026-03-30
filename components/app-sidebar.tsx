"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import { LogoFull, LogoIcon } from "@/components/logo";
import { OrgSwitcher } from "@/components/org-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  Search,
  Building2,
  Zap,
  Bookmark,
  SearchCheck,
  ListTodo,
  Download,
  Settings,
  LogOut,
  Shield,
  Users,
  BarChart3,
  ChevronsUpDown,
  Sparkles,
} from "lucide-react";

// ─── Nav config ─────────────────────────────────────────────────────────────

type NavKey =
  | "dashboard"
  | "search"
  | "recentCompanies"
  | "triggers"
  | "saved"
  | "savedSearches"
  | "todos"
  | "exports"
  | "settings"
  | "adminMembers"
  | "adminUsage"
  | "adminSecurity";

interface NavItem {
  key: NavKey;
  icon: typeof Home;
  href: string;
}

interface NavSection {
  key: string;
  label: string;
  labelDa: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    key: "main",
    label: "Platform",
    labelDa: "Platform",
    items: [
      { key: "dashboard", icon: Home, href: "/dashboard" },
      { key: "search", icon: Search, href: "/search" },
      { key: "recentCompanies", icon: Building2, href: "/recent-companies" },
    ],
  },
  {
    key: "leads",
    label: "Lead Pipeline",
    labelDa: "Lead Pipeline",
    items: [
      { key: "triggers", icon: Zap, href: "/triggers" },
      { key: "saved", icon: Bookmark, href: "/saved" },
      { key: "savedSearches", icon: SearchCheck, href: "/saved-searches" },
    ],
  },
  {
    key: "tools",
    label: "Tools",
    labelDa: "Værktøjer",
    items: [
      { key: "todos", icon: ListTodo, href: "/todos" },
      { key: "exports", icon: Download, href: "/exports" },
    ],
  },
];

const adminSection: NavSection = {
  key: "admin",
  label: "Organization",
  labelDa: "Organisation",
  items: [
    { key: "adminMembers", icon: Users, href: "/settings/org/members" },
    { key: "adminUsage", icon: BarChart3, href: "/settings/org/billing" },
    { key: "adminSecurity", icon: Shield, href: "/settings/org/security" },
  ],
};

const ADMIN_ROLES = new Set(["owner", "admin", "manager"]);

// ─── AppSidebar ─────────────────────────────────────────────────────────────

interface AppSidebarProps {
  user: {
    id?: string;
    name: string | null;
    email: string;
    image?: string | null;
  };
  onLogout: () => void;
}

export function AppSidebar({ user, onLogout }: AppSidebarProps) {
  const pathname = usePathname();
  const { t, locale } = useLanguage();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const d = t.dashboard;

  const userId = (user as any)?.id ?? null;
  const [userRole, setUserRole] = useState("member");
  useEffect(() => {
    if (!userId) return;
    fetch("/api/admin/members")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.members) return;
        const me = data.members.find((m: any) => m.userId === userId);
        if (me?.role) setUserRole(me.role);
      })
      .catch(() => {});
  }, [userId]);

  const showAdmin = ADMIN_ROLES.has(userRole);
  const allSections = showAdmin ? [...navSections, adminSection] : navSections;

  const userName = user?.name ?? "";
  const userEmail = user?.email ?? "";
  const initials = (userName || userEmail)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <Sidebar collapsible="icon" className="border-r-0 font-[var(--font-inter)]">
      {/* ── Header ── */}
      <SidebarHeader className="pb-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-transparent active:bg-transparent pointer-events-none"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400">
                <Sparkles className="size-4 text-white" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-bold tracking-tight text-white">
                  CVR-MATE
                </span>
                <span className="truncate text-[11px] text-slate-500">
                  Lead Intelligence
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Org switcher */}
        <div className="mt-1 px-1">
          <OrgSwitcher collapsed={isCollapsed} />
        </div>
      </SidebarHeader>

      <SidebarSeparator className="bg-white/[0.04]" />

      {/* ── Nav groups ── */}
      <SidebarContent>
        {allSections.map((section) => (
          <SidebarGroup key={section.key}>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 px-3">
              {locale === "da" ? section.labelDa : section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={d.nav[item.key]}
                        render={<Link href={item.href} />}
                        className="relative text-[13px] font-medium text-slate-400 hover:text-slate-200 data-[active=true]:text-white data-[active=true]:font-semibold group/nav"
                      >
                        {/* Active indicator bar */}
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-blue-400 to-cyan-400 group-data-[collapsible=icon]:hidden" />
                        )}
                        <Icon className="size-[16px] shrink-0 text-slate-500 group-data-[active=true]/nav:text-blue-400" />
                        <span>{d.nav[item.key]}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter>
        {/* Settings */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname.startsWith("/settings")}
              tooltip={d.nav.settings}
              render={<Link href="/settings" />}
              className="text-[13px] font-medium text-slate-400 hover:text-slate-200 data-[active=true]:text-white data-[active=true]:font-semibold"
            >
              <Settings className="size-[16px] text-slate-500 data-[active=true]:text-blue-400" />
              <span>{d.nav.settings}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator className="bg-white/[0.04]" />

        {/* User dropdown */}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full cursor-pointer outline-none">
                <SidebarMenuButton
                  size="lg"
                  render={<div />}
                  className="hover:bg-white/[0.04] data-[state=open]:bg-white/[0.06]"
                >
                  {user?.image ? (
                    <img
                      src={user.image}
                      alt={userName}
                      className="size-8 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 text-white text-[11px] font-bold shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-semibold text-slate-200">
                      {userName || "User"}
                    </span>
                    <span className="truncate text-[11px] text-slate-500">
                      {userEmail}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-slate-600" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl"
                side="top"
                align="start"
                sideOffset={8}
              >
                <div className="flex items-center gap-3 p-3">
                  {user?.image ? (
                    <img
                      src={user.image}
                      alt={userName}
                      className="size-9 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 text-white text-xs font-bold">
                      {initials}
                    </div>
                  )}
                  <div className="grid text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {userName || "User"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="cursor-pointer text-red-500 focus:text-red-500"
                >
                  <LogOut className="mr-2 size-4" />
                  {d.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
