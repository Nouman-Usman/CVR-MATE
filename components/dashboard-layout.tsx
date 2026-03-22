"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useSession, signOut, getCachedSession } from "@/lib/auth-client";
import { useLanguage } from "@/lib/i18n/language-context";
import { LogoFull } from "@/components/logo";

const navItems = [
  { key: "dashboard" as const, icon: "home", href: "/dashboard" },
  { key: "search" as const, icon: "search", href: "/search" },
  { key: "recentCompanies" as const, icon: "apartment", href: "/recent-companies" },
  { key: "triggers" as const, icon: "bolt", href: "/triggers" },
  { key: "saved" as const, icon: "bookmark", href: "/saved" },
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
            <button className="relative text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <span className="material-symbols-outlined text-xl">
                notifications
              </span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
            </button>
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
