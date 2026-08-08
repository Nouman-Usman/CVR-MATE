"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { useSession, signOut, getCachedSession } from "@/lib/auth-client";
import { useLanguage } from "@/lib/i18n/language-context";
import { LogoFull, LogoIcon } from "@/components/logo";
import WorkspaceSwitcher from "@/components/workspace-switcher";
import { switchWorkspaceAndGo, useWorkspaces } from "@/lib/hooks/use-workspace";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  
  useDeleteNotification,
  useNotificationStream,
} from "@/lib/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { UpgradeModal } from "@/components/upgrade/UpgradeModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  Search,
  Building2,
  Flame,
  Zap,
  Bookmark,
  SearchCheck,
  ListTodo,
  KanbanSquare,
  Download,
  UserCheck,
  ScanSearch,
  MessagesSquare,
  BarChart3,
  History,
  FileSpreadsheet,
  Command,
  FileText,
  ShoppingCart,
  Package,
  Settings,
  Menu,
  Bell,
  Globe,
  LogOut,
  Loader2,
  Sparkles,
  X,
  Info,
  BellOff,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsLeft,
} from "lucide-react";
import { CommandPalette, openCommandPalette } from "@/components/crm/CommandPalette";

/** Stable subscriptions for useSyncExternalStore (identity must not change). */
function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
/** Hydration never changes after it happens, so nothing to subscribe to. */
function subscribeNever(): () => void {
  return () => {};
}

// ── Nav structure with grouped sections ──────────────────────────────

type NavKey = "dashboard" | "matches" | "agent" | "search" | "recentCompanies" | "triggers" | "saved" | "savedSearches" | "todos" | "followedPeople" | "records" | "interactions" | "pipeline" | "reports" | "history" | "import" | "quotes" | "orders" | "products" | "exports" | "settings";

interface NavItem {
  key: NavKey;
  icon: typeof Home;
  href: string;
}

interface NavSection {
  label: string;
  labelDa: string;
  items: NavItem[];
  /** Hidden unless an organization is the active workspace. */
  requiresOrganization?: boolean;
}

/**
 * Grouped by what the user is trying to *do*, not by which release built it.
 *
 * The previous shape had the CRM split across a "Tools" section (records,
 * interactions, pipeline, reports) and a separate "Sales" section (quotes,
 * orders, products) — one domain, two homes, with lead-discovery features mixed
 * into both. It also listed "Prospects" as a nav destination pointing at a
 * *creation form*: a verb sitting between nouns, with no list page behind it, so
 * a prospect you created yesterday was unreachable from the nav at all. Creating
 * a prospect is now a button on /records, which is the list it belongs to.
 */
const navSections: NavSection[] = [
  {
    label: "Overview",
    labelDa: "Oversigt",
    items: [
      { key: "dashboard", icon: Home, href: "/dashboard" },
      { key: "matches", icon: Flame, href: "/matches" },
      { key: "agent", icon: Sparkles, href: "/agent" },
    ],
  },
  {
    // Finding companies you do not know yet.
    label: "Discover",
    labelDa: "Find virksomheder",
    items: [
      { key: "search", icon: Search, href: "/search" },
      { key: "recentCompanies", icon: Building2, href: "/recent-companies" },
      { key: "savedSearches", icon: SearchCheck, href: "/saved-searches" },
      { key: "triggers", icon: Zap, href: "/triggers" },
    ],
  },
  {
    // Working the companies you already have a relationship with.
    // Every table behind these pages carries a NOT NULL organization id, so
    // they simply do not exist in the personal workspace.
    requiresOrganization: true,
    label: "CRM",
    labelDa: "CRM",
    items: [
      { key: "records", icon: ScanSearch, href: "/records" },
      { key: "import", icon: FileSpreadsheet, href: "/import" },
      { key: "pipeline", icon: KanbanSquare, href: "/pipeline" },
      { key: "interactions", icon: MessagesSquare, href: "/interactions" },
      { key: "quotes", icon: FileText, href: "/quotes" },
      { key: "orders", icon: ShoppingCart, href: "/orders" },
      { key: "products", icon: Package, href: "/products" },
      { key: "reports", icon: BarChart3, href: "/reports" },
      { key: "history", icon: History, href: "/history" },
    ],
  },
  {
    label: "My work",
    labelDa: "Mit arbejde",
    items: [
      { key: "todos", icon: ListTodo, href: "/todos" },
      { key: "saved", icon: Bookmark, href: "/saved" },
      { key: "followedPeople", icon: UserCheck, href: "/followed-people" },
      { key: "exports", icon: Download, href: "/exports" },
    ],
  },
];

const settingsItem: NavItem = { key: "settings", icon: Settings, href: "/settings" };

// ── Sidebar content (shared between desktop + mobile) ────────────────

function SidebarNav({
  pathname,
  d,
  locale,
  collapsed,
  onNavClick,
  onLogout,
  onToggleCollapse,
  user,
  initials,
  showCollapseToggle,
}: {
  pathname: string;
  d: ReturnType<typeof useLanguage>["t"]["dashboard"];
  locale: string;
  collapsed: boolean;
  onNavClick: () => void;
  onLogout: () => void;
  onToggleCollapse?: () => void;
  user: { name: string | null; email: string };
  initials: string;
  showCollapseToggle: boolean;
}) {
  // The nav reflects the active workspace, not just the plan.
  const { isPersonal: isPersonalWorkspace } = useWorkspaces();

  return (
    <div className="flex flex-col h-full">
      {/* Logo + collapse toggle */}
      <div className={cn(
        "h-16 flex items-center shrink-0 border-b border-white/[0.06]",
        collapsed ? "justify-center px-2" : "justify-between px-5"
      )}>
        {collapsed ? (
          <LogoIcon size={28} />
        ) : (
          <LogoFull size="small" variant="dark" />
        )}
        {showCollapseToggle && !collapsed && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onToggleCollapse}
            className="text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]"
          >
            <ChevronsLeft className="size-4" />
          </Button>
        )}
      </div>

      {/* Workspace — above everything, because it changes what every list below
          it contains. Renders nothing for users with no organizations. */}
      <div className={cn("pt-3", collapsed ? "px-2" : "px-3")}>
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      {/* Search — sits above the nav because it is the fastest route to any
          record, and a shortcut nobody can see is a shortcut nobody uses. */}
      <div className={cn("pt-3", collapsed ? "px-2" : "px-3")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={openCommandPalette}
                  aria-label={locale === "da" ? "Søg" : "Search"}
                  className="flex w-full items-center justify-center rounded-lg py-2.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer"
                />
              }
            >
              <Search className="size-[18px]" />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {locale === "da" ? "Søg" : "Search"} (⌘K)
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={openCommandPalette}
            className="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-slate-400 transition-colors hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-slate-200 cursor-pointer"
          >
            <Search className="size-4 shrink-0" />
            <span className="flex-1 text-left">
              {locale === "da" ? "Søg…" : "Search…"}
            </span>
            <kbd className="inline-flex shrink-0 items-center gap-0.5 rounded border border-white/[0.12] bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              <Command className="size-2.5" />K
            </kbd>
          </button>
        )}
      </div>

      {/* Nav sections. Org-only groups are hidden in the personal workspace:
          offering nine destinations that every one of them fails to load is
          worse than not offering them, and the failure read as a bug. */}
      <nav className={cn("flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")}>
        {navSections
          .filter((section) => !section.requiresOrganization || !isPersonalWorkspace)
          .map((section, sIdx) => (
          <div key={section.label} className={sIdx > 0 ? "mt-5" : ""}>
            {/* Section label */}
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500/80">
                {locale === "da" ? section.labelDa : section.label}
              </p>
            )}
            {collapsed && sIdx > 0 && (
              <Separator className="mx-auto mb-2.5 bg-white/[0.06] w-6" />
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                const linkContent = (
                  <Link
                    href={item.href}
                    onClick={onNavClick}
                    className={cn(
                      "group relative flex items-center rounded-lg text-[13px] font-medium transition-all duration-150",
                      collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2",
                      isActive
                        ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                    )}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <span className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-gradient-to-b from-blue-400 to-cyan-400",
                        collapsed ? "h-4 -left-2" : "h-5"
                      )} />
                    )}
                    <Icon className={cn(
                      "shrink-0 transition-colors duration-150",
                      collapsed ? "size-[18px]" : "size-4",
                      isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
                    )} />
                    {!collapsed && (
                      <span className="truncate">{d.nav[item.key]}</span>
                    )}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.key}>
                      <TooltipTrigger className="w-full">
                        {linkContent}
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {d.nav[item.key]}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return <div key={item.key}>{linkContent}</div>;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: Settings + User */}
      <div className={cn("shrink-0 border-t border-white/[0.05]", collapsed ? "px-2 py-3" : "px-3 py-3")}>
        {/* Settings link */}
        {(() => {
          const isActive = pathname === settingsItem.href;
          const settingsLink = (
            <Link
              href={settingsItem.href}
              onClick={onNavClick}
              className={cn(
                "group relative flex items-center rounded-lg text-sm font-medium transition-all duration-200 mb-3",
                collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-white/[0.1] text-white"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              )}
            >
              {isActive && (
                <span className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-gradient-to-b from-blue-400 to-cyan-400",
                  collapsed ? "h-5 -left-2" : "h-6"
                )} />
              )}
              <Settings className={cn(
                "shrink-0 transition-colors",
                collapsed ? "size-5" : "size-[18px]",
                isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
              )} />
              {!collapsed && <span className="truncate">{d.nav.settings}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip>
                <TooltipTrigger className="w-full">{settingsLink}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>{d.nav.settings}</TooltipContent>
              </Tooltip>
            );
          }
          return settingsLink;
        })()}

        <Separator className="mb-3 bg-white/[0.06]" />

        {/* User profile */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger className="w-full">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold mx-auto cursor-default">
                {initials}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p className="font-semibold">{user.name || "User"}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-200 truncate">
                {user.name || "User"}
              </p>
              <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onLogout}
              className="text-slate-500 hover:text-red-400 hover:bg-white/[0.06] shrink-0"
              title={d.logout}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        )}

        {/* Expand button in collapsed mode */}
        {collapsed && showCollapseToggle && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onToggleCollapse}
            className="text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] w-full mt-3"
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main layout ──────────────────────────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t, locale, toggleLocale } = useLanguage();
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // "x minutes ago" needs a clock, but `Date.now()` in render is impure — it
  // makes the output depend on when React happens to render, which breaks under
  // concurrent rendering and never refreshed anyway. Sampled when the dropdown
  // opens, which is the only moment the labels are actually read.
  const [notificationsNow, setNotificationsNow] = useState(() => Date.now());
  // localStorage is an external store, so it is read through
  // useSyncExternalStore rather than an effect that calls setState: the server
  // snapshot (false) and the first client render agree, so there is no
  // hydration mismatch and no post-mount flash of the wrong sidebar width.
  const storedCollapsed = useSyncExternalStore(
    subscribeToStorage,
    () => window.localStorage.getItem("sidebar-collapsed") === "true",
    () => false
  );
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(null);
  const collapsed = collapsedOverride ?? storedCollapsed;
  const setCollapsed = setCollapsedOverride;

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  // Which workspace the notification list should compare against.
  const { activeOrgId: activeWorkspaceOrgId } = useWorkspaces();

  useNotificationStream();
  const { data: notifData } = useNotifications();
  const unreadCount = useUnreadCount();
  const markRead = useMarkAsRead();
  const markAllRead = useMarkAllAsRead();
  const deleteNotif = useDeleteNotification();
  const notifications = notifData?.notifications ?? [];

  const cachedSession = getCachedSession();
  const activeSession = session || (isPending ? cachedSession : null);

  // "Has the client hydrated yet?" is an environment fact, not component state.
  // useSyncExternalStore expresses it directly: false on the server, true on the
  // client, with no effect and no setState.
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Sync authenticated user identity to Sentry so errors are linked to accounts
  useEffect(() => {
    const user = session?.user;
    if (user) {
      Sentry.setUser({ id: user.id, email: user.email, name: user.name ?? undefined });
    } else {
      // Clear user from Sentry when logged out
      Sentry.setUser(null);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!mounted || !activeSession) return;
    if (sessionStorage.getItem("onboarding_complete") === "true") return;
    const skipped = sessionStorage.getItem("onboarding_skipped") === "true";

    fetch("/api/brand")
      .then((res) => res.json())
      .then((data) => {
        if (!data.brand) {
          if (skipped) {
            setShowOnboardingBanner(true);
          } else {
            router.push("/onboarding");
          }
        } else {
          sessionStorage.setItem("onboarding_complete", "true");
        }
      })
      .catch(() => {});
  }, [mounted, activeSession, router]);

  if (!mounted || !activeSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-10 text-primary animate-spin" />
      </div>
    );
  }

  const user = activeSession.user;
  const initials = (user.name || user.email)
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const d = t.dashboard;

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const getTypeIcon = (type: string) => {
    if (type === "trigger") return <Zap className="size-3.5" />;
    if (type === "export") return <Download className="size-3.5" />;
    return <Info className="size-3.5" />;
  };

  const getTypeColor = (type: string) => {
    if (type === "trigger") return "bg-blue-50 text-blue-600";
    if (type === "export") return "bg-emerald-50 text-emerald-600";
    return "bg-slate-50 text-slate-500";
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mounted once for every protected page — ⌘K works from anywhere. */}
      <CommandPalette />

      {/* Mobile sidebar via Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[280px] p-0 bg-[#0f172a] border-r-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav
            pathname={pathname}
            d={d}
            locale={locale}
            collapsed={false}
            onNavClick={() => setSidebarOpen(false)}
            onLogout={handleLogout}
            user={user}
            initials={initials}
            showCollapseToggle={false}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar — visible from md breakpoint (768px+) */}
      <aside
        className={cn(
          "hidden md:flex sticky top-0 left-0 h-screen bg-[#0f172a] flex-col z-50 transition-all duration-300 ease-in-out shrink-0",
          collapsed ? "w-[68px]" : "w-[260px]"
        )}
      >
        <SidebarNav
          pathname={pathname}
          d={d}
          locale={locale}
          collapsed={collapsed}
          onNavClick={() => {}}
          onLogout={handleLogout}
          onToggleCollapse={toggleCollapse}
          user={user}
          initials={initials}
          showCollapseToggle={true}
        />
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-border/60 h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden shrink-0"
            >
              <Menu className="size-5" />
            </Button>
            {/* Show logo on mobile when sidebar is hidden */}
            <div className="md:hidden">
              <LogoFull size="small" />
            </div>

            {/* On mobile the sidebar is behind a drawer, so the search entry
                point has to live in the header too — the desktop copy moved
                into the sidebar. */}
            <button
              onClick={openCommandPalette}
              aria-label={locale === "da" ? "Søg" : "Search"}
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <Search className="size-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notification bell + dropdown */}
            <DropdownMenu onOpenChange={(open) => open && setNotificationsNow(Date.now())}>
              <DropdownMenuTrigger className="relative inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer">
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 border-0 hover:bg-red-500">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[380px] max-h-[480px] p-0 overflow-hidden flex flex-col rounded-2xl">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-bold text-foreground">{t.notifications.title}</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer"
                    >
                      {t.notifications.markAllRead}
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1">
                  {notifications.length === 0 ? (
                    <div className="py-12 text-center">
                      <BellOff className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">{t.notifications.noNotifications}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {notifications.map((n) => {
                        const age = notificationsNow - new Date(n.createdAt).getTime();
                        const mins = Math.floor(age / 60000);
                        const hours = Math.floor(age / 3600000);
                        const days = Math.floor(age / 86400000);
                        const timeAgo = mins < 1
                          ? t.notifications.justNow
                          : mins < 60
                            ? `${mins} ${t.notifications.minutesAgo}`
                            : hours < 24
                              ? `${hours} ${t.notifications.hoursAgo}`
                              : `${days} ${t.notifications.daysAgo}`;

                        return (
                          <div
                            key={n.id}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${
                              !n.isRead ? "bg-accent/30" : ""
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getTypeColor(n.type)}`}>
                              {getTypeIcon(n.type)}
                            </div>
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => {
                                if (!n.isRead) markRead.mutate(n.id);
                                if (!n.link) return;
                                // An org notification opened from a different
                                // workspace would land on a page the CRM guard
                                // refuses, so switch there first. Same
                                // workspace: an ordinary client-side push.
                                if ((n.organizationId ?? null) !== (activeWorkspaceOrgId ?? null)) {
                                  switchWorkspaceAndGo(n.organizationId ?? null, n.link).catch(
                                    () => router.push(n.link!)
                                  );
                                } else {
                                  router.push(n.link);
                                }
                              }}
                            >
                              <p className={`text-sm truncate ${!n.isRead ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                                {n.title}
                              </p>
                              {n.message && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{n.message}</p>
                              )}
                              <div className="mt-1 flex items-center gap-1.5">
                                <p className="text-[10px] text-muted-foreground">{timeAgo}</p>
                                {/* Which workspace this belongs to. Only shown
                                    when it is not the one you are already in —
                                    labelling every row "Personal" while in
                                    Personal is noise. */}
                                {(n.organizationId ?? null) !== (activeWorkspaceOrgId ?? null) && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    {n.organizationId ? (
                                      <Building2 className="size-2.5" />
                                    ) : (
                                      <UserCheck className="size-2.5" />
                                    )}
                                    {n.organizationName ??
                                      (locale === "da" ? "Personligt" : "Personal")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotif.mutate(n.id);
                              }}
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" onClick={toggleLocale}>
              <Globe className="size-4" />
              <span className="text-xs font-bold">{locale === "da" ? "EN" : "DA"}</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {showOnboardingBanner && !bannerDismissed && (
            <div className="mb-6 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl p-4 flex items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-3 text-white">
                <Sparkles className="size-6 shrink-0" />
                <p className="text-sm font-medium">{t.onboarding.bannerText}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/onboarding"
                  className="px-4 py-2 bg-white text-blue-600 font-bold text-sm rounded-lg hover:bg-blue-50 transition-colors"
                >
                  {t.onboarding.bannerButton}
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setBannerDismissed(true)}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
      <UpgradeModal />
    </div>
  );
}
