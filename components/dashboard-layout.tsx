"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useSession, signOut, getCachedSession } from "@/lib/auth-client";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useNotificationStream,
} from "@/lib/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Bell,
  Globe,
  Loader2,
  Sparkles,
  Zap,
  Download,
  X,
  Info,
  BellOff,
} from "lucide-react";

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

  useNotificationStream();
  const { data: notifData } = useNotifications();
  const unreadCount = useUnreadCount();
  const markRead = useMarkAsRead();
  const markAllRead = useMarkAllAsRead();
  const deleteNotif = useDeleteNotification();
  const notifications = notifData?.notifications ?? [];

  const cachedSession = getCachedSession();
  const activeSession = session || (isPending ? cachedSession : null);

  const [mounted, setMounted] = useState(false);
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [orgReady, setOrgReady] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Ensure user always has an active org (fallback safety net)
  useEffect(() => {
    if (!mounted || !activeSession) return;
    if (orgReady) return;
    fetch("/api/auth/ensure-org", { method: "POST" })
      .then(() => setOrgReady(true))
      .catch(() => setOrgReady(true)); // proceed even if fails
  }, [mounted, activeSession, orgReady]);

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
    if (type === "trigger") return "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400";
    if (type === "export") return "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400";
    return "bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400";
  };

  return (
    <SidebarProvider>
      <AppSidebar user={user} onLogout={handleLogout} />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger className="relative inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer">
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1 border-0 hover:bg-red-500">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[380px] max-h-[480px] p-0 overflow-hidden flex flex-col rounded-xl">
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
                  <div className="divide-y divide-border">
                    {notifications.map((n) => {
                      const age = Date.now() - new Date(n.createdAt).getTime();
                      const mins = Math.floor(age / 60000);
                      const hours = Math.floor(age / 3600000);
                      const days = Math.floor(age / 86400000);
                      const timeAgo =
                        mins < 1
                          ? t.notifications.justNow
                          : mins < 60
                            ? `${mins} ${t.notifications.minutesAgo}`
                            : hours < 24
                              ? `${hours} ${t.notifications.hoursAgo}`
                              : `${days} ${t.notifications.daysAgo}`;

                      return (
                        <div
                          key={n.id}
                          className={cn(
                            "flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors",
                            !n.isRead && "bg-accent/30"
                          )}
                        >
                          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", getTypeColor(n.type))}>
                            {getTypeIcon(n.type)}
                          </div>
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => {
                              if (!n.isRead) markRead.mutate(n.id);
                              if (n.link) router.push(n.link);
                            }}
                          >
                            <p className={cn("text-sm truncate", !n.isRead ? "font-semibold text-foreground" : "text-muted-foreground")}>
                              {n.title}
                            </p>
                            {n.message && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{n.message}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-1">{timeAgo}</p>
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

          {/* Language toggle */}
          <Button variant="ghost" size="sm" onClick={toggleLocale} className="gap-1.5">
            <Globe className="size-4" />
            <span className="text-xs font-bold">{locale === "da" ? "EN" : "DA"}</span>
          </Button>
        </header>

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
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
      </SidebarInset>
    </SidebarProvider>
  );
}
