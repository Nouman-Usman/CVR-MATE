"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, CreditCard, Filter, Activity, Mail, Plug,
  Video, LogOut, Shield, Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Grouped navigation — each section is a labelled block in the rail.
const SECTIONS = [
  { title: "Analytics", items: [{ label: "Overview", href: "/admin/overview", icon: LayoutDashboard }] },
  { title: "Users", items: [{ label: "Users", href: "/admin/users", icon: Users }] },
  {
    title: "Revenue",
    items: [
      { label: "Billing", href: "/admin/billing", icon: CreditCard },
      { label: "Funnel", href: "/admin/funnel", icon: Filter },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Health", href: "/admin/health", icon: Activity },
      { label: "Email", href: "/admin/email", icon: Mail },
      { label: "Integrations", href: "/admin/integrations", icon: Plug },
    ],
  },
  { title: "Content", items: [{ label: "Videos", href: "/admin/videos", icon: Video }] },
];

// Faint vertical register grid — the same surface the marketing hero sits on.
const REGISTER_GRID =
  "linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px)";

/** "dev@fourmates.dk" → "DE" for the avatar fallback. */
function initials(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase() || "AD";
}

function RailBrand() {
  return (
    <div className="flex items-center gap-3 px-5 pt-6 pb-5">
      <div className="size-9 rounded-xl bg-linear-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
        <Shield size={18} className="text-white" />
      </div>
      <div>
        <p className="font-black text-white text-lg tracking-tight leading-none">CVR-MATE</p>
        <p className="mt-1 font-mono text-[9px] text-cyan-400/70 uppercase tracking-[0.28em]">Admin Console</p>
      </div>
    </div>
  );
}

function RailNav({ pathname, onNav }: { pathname: string; onNav?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
      {SECTIONS.map((section) => (
        <div key={section.title} className="space-y-1">
          <p className="px-3 mb-2 font-mono text-[9px] text-slate-500 uppercase tracking-[0.22em]">
            {section.title}
          </p>
          {section.items.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNav}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 outline-none",
                  "focus-visible:ring-2 focus-visible:ring-cyan-400/60",
                  active ? "bg-white/6 text-white font-semibold" : "text-slate-400 hover:text-white hover:bg-white/4"
                )}
              >
                {/* Register-tab marker — you-are-here in the index */}
                <span
                  className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.75 rounded-full bg-cyan-400 transition-opacity duration-200",
                    active ? "opacity-100" : "opacity-0"
                  )}
                />
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg transition-colors",
                    active ? "bg-cyan-400/15 text-cyan-300" : "bg-white/4 text-slate-400 group-hover:text-slate-200"
                  )}
                >
                  <Icon size={15} />
                </span>
                <span className="flex-1">{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function RailFooter({ adminEmail, onLogout }: { adminEmail: string; onLogout: () => void }) {
  const env = process.env.NEXT_PUBLIC_ENV || "development";
  return (
    <div className="shrink-0 border-t border-white/8 px-3 pt-3 pb-4 space-y-2">
      {/* Live status — ties to the /start "CVR-registret · live" console strip */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/4">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
          {env} · live
        </span>
      </div>

      {/* Identity */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="flex items-center gap-3 px-3 py-2 rounded-xl w-full text-left hover:bg-white/4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60" />
          }
        >
          <Avatar className="size-8 border border-white/10">
            <AvatarFallback className="bg-linear-to-br from-blue-600 to-cyan-500 text-white font-bold text-[11px]">{initials(adminEmail)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{adminEmail}</p>
            <p className="font-mono text-[9px] text-cyan-400/70 uppercase tracking-[0.16em]">Super-admin</p>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56 rounded-xl p-1.5 shadow-xl border-slate-100">
          <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5">Signed in as</DropdownMenuLabel>
          <p className="px-2 pb-1.5 text-xs font-medium text-slate-600 truncate">{adminEmail}</p>
          <DropdownMenuSeparator className="bg-slate-50" />
          <DropdownMenuItem
            className="rounded-lg font-medium text-rose-600 focus:text-rose-600 cursor-pointer"
            onClick={onLogout}
          >
            <LogOut size={14} className="mr-2" /> Logout Session
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SidebarContent({
  pathname, adminEmail, onLogout, onNav,
}: {
  pathname: string; adminEmail: string; onLogout: () => void; onNav?: () => void;
}) {
  return (
    <div
      className="flex h-full flex-col bg-[#0a0f1e] font-(family-name:--font-manrope)"
      style={{ backgroundImage: REGISTER_GRID, backgroundSize: "48px 100%" }}
    >
      <RailBrand />
      <RailNav pathname={pathname} onNav={onNav} />
      <RailFooter adminEmail={adminEmail} onLogout={onLogout} />
    </div>
  );
}

export function AdminShell({ children, adminEmail }: { children: React.ReactNode; adminEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const logout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen flex bg-[#fafbfc] font-(family-name:--font-manrope)">
      {/* ── Desktop sidebar — full-height & sticky ── */}
      <aside className="hidden md:flex sticky top-0 h-screen w-64 shrink-0 flex-col border-r border-white/8">
        <SidebarContent pathname={pathname} adminEmail={adminEmail} onLogout={logout} />
      </aside>

      {/* ── Main column ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/8 bg-[#0a0f1e] px-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="rounded-xl text-slate-300 hover:bg-white/6 hover:text-white" />
              }
            >
              <Menu size={22} />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 border-none shadow-2xl bg-[#0a0f1e]">
              <SheetHeader className="sr-only">
                <SheetTitle>Admin Navigation</SheetTitle>
              </SheetHeader>
              <SidebarContent
                pathname={pathname}
                adminEmail={adminEmail}
                onLogout={() => { setMobileOpen(false); logout(); }}
                onNav={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-linear-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <Shield size={14} className="text-white" />
            </div>
            <span className="font-black text-white tracking-tight">CVR-MATE</span>
            <span className="font-mono text-[9px] text-cyan-400/70 uppercase tracking-[0.2em]">Admin</span>
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
