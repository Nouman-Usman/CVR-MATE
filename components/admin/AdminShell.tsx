"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Video, LogOut, Shield, Menu, X, ArrowRight, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
    <div className="flex flex-col h-full py-8 px-4 font-[family-name:var(--font-manrope)]">
      {/* Brand */}
      <div className="flex items-center gap-3 px-3 mb-10">
        <div className="size-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
          <Shield size={18} className="text-white" />
        </div>
        <div>
          <p className="font-black text-slate-900 text-lg tracking-tight leading-none">CVR-MATE</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Admin Panel</p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="px-4 mb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
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
                "group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all duration-300",
                active
                  ? "bg-white text-blue-600 font-extrabold shadow-sm border border-slate-100 shadow-blue-600/5"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-lg transition-colors",
                active ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400 group-hover:bg-white group-hover:shadow-sm"
              )}>
                <Icon size={16} />
              </div>
              <span className="flex-1">{label}</span>
              {active && <ArrowRight size={14} className="opacity-40" />}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto pt-8 border-t border-slate-100">
        <DropdownMenu>
          <DropdownMenuTrigger 
            render={
              <button className="flex items-center gap-3 px-4 py-3 rounded-2xl w-full text-left hover:bg-slate-50 transition-all group outline-none" />
            }
          >
            <Avatar className="size-9 border-2 border-white shadow-sm">
              <AvatarFallback className="bg-blue-600 text-white font-bold text-xs">AD</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">System Admin</p>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Verified</p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 shadow-xl border-slate-100">
            <DropdownMenuLabel className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5">My Account</DropdownMenuLabel>
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
    <div className="min-h-screen bg-[#fafbfc] flex flex-col font-[family-name:var(--font-manrope)]">
      {/* ── Top navbar ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 h-16 flex items-center px-6 gap-4">
        {/* Mobile hamburger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger 
            render={
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden rounded-xl text-slate-500 hover:bg-slate-50"
              />
            }
          >
            <Menu size={22} />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 border-none shadow-2xl bg-[#fafbfc]">
            <SheetHeader className="sr-only">
              <SheetTitle>Admin Navigation</SheetTitle>
            </SheetHeader>
            <SidebarContent
              pathname={pathname}
              onLogout={() => { setMobileOpen(false); logout(); }}
              onNav={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20 md:hidden">
            <Shield size={16} className="text-white" />
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="font-black text-slate-900 text-lg tracking-tight">Admin Console</span>
            <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none text-[9px] font-black uppercase tracking-wider h-5 px-1.5">
              v2.1
            </Badge>
          </div>
        </div>

        <div className="flex-1" />

        {/* Desktop nav shortcuts */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(({ label, href }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                  active
                    ? "text-blue-600 bg-blue-50/50"
                    : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <Separator orientation="vertical" className="h-6 mx-2 hidden md:block opacity-50" />

        {/* User status */}
        <DropdownMenu>
          <DropdownMenuTrigger 
            render={
              <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-white shadow-sm p-0 outline-none" />
            }
          >
            <Avatar className="h-full w-full">
              <AvatarFallback className="bg-blue-600 text-white font-bold text-xs">AD</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 shadow-xl border-slate-100">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold leading-none">System Admin</p>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest leading-none mt-1">Verified Account</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-50" />
            <DropdownMenuItem 
              className="rounded-lg font-medium text-rose-600 focus:text-rose-600 cursor-pointer"
              onClick={logout}
            >
              <LogOut size={14} className="mr-2" /> Logout Session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="w-64 shrink-0 bg-[#fafbfc] border-r border-slate-100 hidden md:block">
          <SidebarContent pathname={pathname} onLogout={logout} />
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto min-w-0">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
