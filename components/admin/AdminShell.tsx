"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Video, LogOut, Shield, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const NAV = [
  { label: "Overview", href: "/admin/overview", icon: LayoutDashboard },
  { label: "Videos", href: "/admin/videos", icon: Video },
];

function SidebarContent({
  pathname,
  onLogout,
  onNav,
}: {
  pathname: string;
  onLogout: () => void;
  onNav?: () => void;
}) {
  return (
    <div className="flex flex-col h-full py-5 px-3">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-3 mb-6">
        <div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center shrink-0">
          <Shield size={14} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-[#191c1e] text-sm leading-tight">CVR-MATE</p>
          <p className="text-[10px] text-[#64748b] uppercase tracking-wider">Admin</p>
        </div>
      </div>

      <p className="px-3 mb-2 text-[10px] font-semibold text-[#64748b] uppercase tracking-widest">
        Platform
      </p>

      {NAV.map(({ label, href, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNav}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-colors",
              active
                ? "bg-[#eff6ff] text-[#2563eb] font-semibold"
                : "text-[#64748b] hover:text-[#191c1e] hover:bg-[#f1f5f9]"
            )}
          >
            <Icon size={15} />
            {label}
          </Link>
        );
      })}

      <div className="mt-auto pt-5 border-t border-[#e2e8f0]">
        <p className="px-3 mb-2 text-[10px] font-semibold text-[#64748b] uppercase tracking-widest">
          System
        </p>
        <button
          onClick={onLogout}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm w-full text-left text-[#64748b] hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const logout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex flex-col">
      {/* ── Top navbar ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#e2e8f0] h-14 flex items-center px-4 md:px-6 gap-3 shadow-sm">
        {/* Mobile hamburger */}
        <button
          className="md:hidden p-1.5 rounded-md text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        {/* Desktop brand */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center">
            <Shield size={14} className="text-white" />
          </div>
          <span className="font-bold text-[#191c1e] text-sm">CVR-MATE</span>
          <span className="text-[#94a3b8] text-sm">Admin</span>
        </div>

        {/* Mobile brand (centered) */}
        <div className="flex md:hidden items-center gap-2 flex-1 justify-center">
          <div className="w-6 h-6 rounded-md bg-[#2563eb] flex items-center justify-center">
            <Shield size={12} className="text-white" />
          </div>
          <span className="font-bold text-[#191c1e] text-sm">CVR-MATE Admin</span>
        </div>

        <Separator orientation="vertical" className="h-5 mx-1 hidden md:block" />

        {/* Desktop nav links */}
        <nav className="hidden md:flex gap-1 flex-1">
          {NAV.map(({ label, href }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-[#eff6ff] text-[#2563eb]"
                    : "text-[#64748b] hover:text-[#191c1e] hover:bg-[#f1f5f9]"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop logout */}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="hidden md:flex text-[#64748b] text-xs gap-1.5 hover:text-red-600 hover:bg-red-50"
        >
          <LogOut size={13} />
          Logout
        </Button>
      </header>

      {/* ── Mobile Sheet sidebar ── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-[#f8fafc] border-r border-[#e2e8f0]">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent
            pathname={pathname}
            onLogout={() => { setMobileOpen(false); logout(); }}
            onNav={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="w-52 shrink-0 bg-[#f8fafc] border-r border-[#e2e8f0] hidden md:block">
          <SidebarContent pathname={pathname} onLogout={logout} />
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
