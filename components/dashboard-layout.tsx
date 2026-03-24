"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useSession, signOut, getCachedSession } from "@/lib/auth-client";
import { useLanguage } from "@/lib/i18n/language-context";
import { LogoFull } from "@/components/logo";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useNotificationStream,
} from "@/lib/hooks/use-notifications";

const navItems = [
  { key: "dashboard" as const, icon: "home", href: "/dashboard" },
  { key: "search" as const, icon: "search", href: "/search" },
  { key: "recentCompanies" as const, icon: "apartment", href: "/recent-companies" },
  { key: "triggers" as const, icon: "bolt", href: "/triggers" },
  { key: "saved" as const, icon: "bookmark", href: "/saved" },
  { key: "savedSearches" as const, icon: "saved_search", href: "/saved-searches" },
  { key: "todos" as const, icon: "task_alt", href: "/todos" },
  { key: "exports" as const, icon: "download", href: "/exports" },
  { key: "settings" as const, icon: "settings", href: "/settings" },
];

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
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Real-time notifications
  useNotificationStream();
  const { data: notifData } = useNotifications();
  const unreadCount = useUnreadCount();
  const markRead = useMarkAsRead();
  const markAllRead = useMarkAllAsRead();
  const deleteNotif = useDeleteNotification();
  const notifications = notifData?.notifications ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Use cached session for instant render while real session loads
  const cachedSession = getCachedSession();
  const activeSession = session || (isPending ? cachedSession : null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Middleware handles redirects — just show loading if no data yet
  if (!mounted || !activeSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f9fb]">
        <span className="material-symbols-outlined animate-spin text-4xl text-blue-600">
          progress_activity
        </span>
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

  return (
    <div className="min-h-screen flex bg-[#f7f9fb]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-[260px] bg-white border-r border-slate-200 flex flex-col z-50 transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 h-16 flex items-center border-b border-slate-100 shrink-0">
          <LogoFull size="small" />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span
                  className="material-symbols-outlined text-xl"
                  style={
                    isActive
                      ? { fontVariationSettings: "'FILL' 1" }
                      : undefined
                  }
                >
                  {item.icon}
                </span>
                {d.nav[item.key]}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {user.name || "User"}
              </p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-500 transition-colors p-1 cursor-pointer shrink-0"
              title={d.logout}
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-8 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-600 p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notification bell + dropdown */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">
                  notifications
                </span>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 flex flex-col">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <h3 className="text-sm font-bold text-slate-900">{t.notifications.title}</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllRead.mutate()}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        {t.notifications.markAllRead}
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <div className="py-12 text-center">
                        <span className="material-symbols-outlined text-4xl text-slate-200 mb-2 block">
                          notifications_none
                        </span>
                        <p className="text-sm text-slate-400">{t.notifications.noNotifications}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {notifications.map((n) => {
                          const age = Date.now() - new Date(n.createdAt).getTime();
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

                          const typeIcon = n.type === "trigger" ? "bolt" : n.type === "export" ? "download" : "info";
                          const typeColor = n.type === "trigger" ? "bg-blue-50 text-blue-600" : n.type === "export" ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500";

                          return (
                            <div
                              key={n.id}
                              className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors ${
                                !n.isRead ? "bg-blue-50/30" : ""
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeColor}`}>
                                <span className="material-symbols-outlined text-sm">{typeIcon}</span>
                              </div>
                              <div
                                className="flex-1 min-w-0 cursor-pointer"
                                onClick={() => {
                                  if (!n.isRead) markRead.mutate(n.id);
                                  if (n.link) {
                                    router.push(n.link);
                                    setNotifOpen(false);
                                  }
                                }}
                              >
                                <p className={`text-sm truncate ${!n.isRead ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                                  {n.title}
                                </p>
                                {n.message && (
                                  <p className="text-xs text-slate-400 truncate mt-0.5">{n.message}</p>
                                )}
                                <p className="text-[10px] text-slate-400 mt-1">{timeAgo}</p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotif.mutate(n.id);
                                }}
                                className="shrink-0 p-1 rounded text-slate-300 hover:text-red-400 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-sm">close</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={toggleLocale}
              className="text-slate-500 hover:bg-slate-50 p-2 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">
                language
              </span>
              <span className="text-xs font-bold">
                {locale === "da" ? "EN" : "DA"}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
