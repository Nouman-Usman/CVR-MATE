"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import { useSession } from "@/lib/auth-client";
import { VideoTrigger } from "@/components/videos/VideoTrigger";
import DashboardLayout from "@/components/dashboard-layout";
import { InlineLoader } from "@/components/loading-screen";
import { useDashboard } from "@/lib/hooks/use-dashboard";
import { companyColors } from "@/lib/constants/colors";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SearchCheck,
  Zap,
  Bookmark,
  ListTodo,
  ArrowRight,
  ArrowUpRight,
  PlusCircle,
  Download,
  ChevronRight,
  Plus,
  TrendingUp,
  Activity,
  Sparkles,
  Calendar,
} from "lucide-react";

export default function DashboardPage() {
  const { t, locale } = useLanguage();
  const { data: session } = useSession();
  const d = t.dashboard;

  const { data, isLoading } = useDashboard();
  const stats = data?.stats;
  const weeklyActivity = data?.weeklyActivity ?? [0, 0, 0, 0, 0, 0, 0];
  const recentCompanies = data?.recentCompanies ?? [];

  const maxWeekly = Math.max(...weeklyActivity, 1);
  const totalWeekly = weeklyActivity.reduce((a, b) => a + b, 0);

  const firstName = session?.user?.name?.split(" ")[0] || session?.user?.email?.split("@")[0] || "";

  const statCards = [
    {
      label: d.savedSearches,
      value: stats?.savedSearches ?? 0,
      icon: SearchCheck,
      gradient: "from-blue-500 to-blue-600",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
      href: "/saved-searches",
    },
    {
      label: d.activeTriggers,
      value: stats?.activeTriggers ?? 0,
      icon: Zap,
      gradient: "from-amber-500 to-orange-500",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
      href: "/triggers",
    },
    {
      label: t.saved.title,
      value: stats?.savedCompanies ?? 0,
      icon: Bookmark,
      gradient: "from-emerald-500 to-teal-500",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
      href: "/saved",
    },
    {
      label: t.todos.activeTasks,
      value: stats?.activeTasks ?? 0,
      icon: ListTodo,
      gradient: "from-violet-500 to-purple-500",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-500",
      href: "/todos",
    },
  ];

  const quickAccessItems = [
    {
      label: d.createTrigger,
      description: locale === "da" ? "Opsæt automatiserede leads" : "Set up automated leads",
      icon: PlusCircle,
      href: "/triggers",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
    },
    {
      label: d.savedSearchesLink,
      description: locale === "da" ? "Kør dine gemte søgninger" : "Run your saved searches",
      icon: Bookmark,
      href: "/saved-searches",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
    },
    {
      label: d.exportLeads,
      description: locale === "da" ? "Download til CSV eller CRM" : "Download to CSV or CRM",
      icon: Download,
      href: "/exports",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
    },
  ];

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12
    ? (locale === "da" ? "Godmorgen" : "Good morning")
    : hour < 18
      ? (locale === "da" ? "God eftermiddag" : "Good afternoon")
      : (locale === "da" ? "God aften" : "Good evening");

  return (
    <VideoTrigger featureKey="dashboard">
      <DashboardLayout>
        {/* ── Hero header with greeting ────────────────────────────── */}
        <div className="mb-8 sm:mb-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)]">
              {greeting}, {firstName} <span className="inline-block origin-[70%_70%] animate-[wave_2s_ease-in-out_infinite]">👋</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              {d.subtitle}
            </p>
          </div>
          <Link href="/search" className="hidden sm:block">
            <Button variant="gradient" size="lg" className="rounded-xl gap-2">
              <Sparkles className="size-4" />
              {locale === "da" ? "Ny søgning" : "New search"}
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className={cn(
                "relative overflow-hidden group py-0 border-0 shadow-sm hover:shadow-lg transition-all duration-300",
                "before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-300",
                "hover:before:opacity-100",
                "hover:-translate-y-0.5"
              )}>
                {/* Subtle gradient glow on hover */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300",
                  stat.gradient
                )} />
                <CardContent className="relative p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.iconBg)}>
                      <Icon className={cn("size-5", stat.iconColor)} />
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-9 w-14 mb-1" />
                  ) : (
                    <p className="text-3xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)] tracking-tight">
                      {stat.value}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground font-medium mt-1">
                    {stat.label}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ── Activity chart + Quick actions ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5 mb-8">
        {/* Weekly activity chart — 3 cols */}
        <Card className="lg:col-span-3 py-0 border-0 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Activity className="size-4 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{d.weeklyChart}</h3>
                  <p className="text-xs text-muted-foreground">
                    {isLoading ? "..." : `${totalWeekly} ${locale === "da" ? "i alt" : "total"}`}
                  </p>
                </div>
              </div>
              {!isLoading && totalWeekly > 0 && (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-0 font-semibold gap-1">
                  <TrendingUp className="size-3" />
                  {locale === "da" ? "Aktiv" : "Active"}
                </Badge>
              )}
            </div>

            {/* Chart */}
            <div className="flex items-end gap-1.5 sm:gap-3 h-[180px] sm:h-[200px] pt-4">
              {weeklyActivity.map((val, i) => {
                const isToday = i === new Date().getDay() - 1 || (new Date().getDay() === 0 && i === 6);
                const heightPercent = Math.max((val / maxWeekly) * 100, 3);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    {/* Value label */}
                    <span className={cn(
                      "text-[10px] font-bold tabular-nums transition-colors",
                      isToday ? "text-blue-500" : "text-muted-foreground/60",
                      "group-hover:text-foreground"
                    )}>
                      {isLoading ? "" : val}
                    </span>

                    {/* Bar */}
                    <div className="w-full flex justify-center flex-1 items-end">
                      {isLoading ? (
                        <Skeleton className="w-full max-w-[44px] h-1/3 rounded-xl" />
                      ) : (
                        <div
                          className={cn(
                            "w-full max-w-[44px] rounded-xl transition-all duration-500 relative",
                            "group-hover:shadow-[0_4px_20px_rgba(37,99,235,0.3)]",
                            val === 0 && "bg-slate-100"
                          )}
                          style={{
                            height: `${heightPercent}%`,
                            background: val > 0
                              ? isToday
                                ? "linear-gradient(to top, #2563eb, #06b6d4)"
                                : "linear-gradient(to top, #2563eb, #60a5fa)"
                              : undefined,
                          }}
                        >
                          {/* Glow dot on top for today */}
                          {isToday && val > 0 && (
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Day label */}
                    <span className={cn(
                      "text-[10px] sm:text-xs font-semibold transition-colors",
                      isToday ? "text-blue-500" : "text-muted-foreground/50",
                    )}>
                      {d.days[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick actions — 2 cols */}
        <Card className="lg:col-span-2 py-0 border-0 shadow-sm">
          <CardContent className="p-5 sm:p-6 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Sparkles className="size-4 text-violet-500" />
              </div>
              <h3 className="text-sm font-bold text-foreground">{d.quickAccess}</h3>
            </div>

            <div className="space-y-2.5 flex-1">
              {quickAccessItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="group flex items-center gap-4 p-3.5 rounded-xl border border-border/40 bg-card hover:border-primary/20 hover:bg-accent/50 transition-all duration-200"
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", item.iconBg)}>
                      <Icon className={cn("size-4", item.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                );
              })}
            </div>

            {/* Mobile CTA */}
            <Link href="/search" className="sm:hidden mt-4">
              <Button variant="gradient" size="lg" className="w-full rounded-xl gap-2">
                <Sparkles className="size-4" />
                {locale === "da" ? "Ny søgning" : "New search"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent trigger results ─────────────────────────────── */}
      <Card className="overflow-hidden border-0 shadow-sm py-0">
        <CardContent className="p-0">
          <div className="p-5 sm:p-6 pb-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Zap className="size-4 text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">{d.recentTriggers}</h3>
                {!isLoading && recentCompanies.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {recentCompanies.length} {locale === "da" ? "virksomheder" : "companies"}
                  </p>
                )}
              </div>
            </div>
            {!isLoading && recentCompanies.length > 0 && (
              <Link href="/triggers">
                <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground hover:text-primary">
                  {locale === "da" ? "Se alle" : "View all"}
                  <ArrowRight className="size-3" />
                </Button>
              </Link>
            )}
          </div>

          {isLoading ? (
            <InlineLoader />
          ) : recentCompanies.length === 0 ? (
            <div className="py-16 text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="size-7 text-amber-500/60" />
              </div>
              <p className="text-foreground font-semibold mb-1.5">
                {locale === "da" ? "Ingen trigger-resultater endnu" : "No trigger results yet"}
              </p>
              <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                {d.noResults}
              </p>
              <Link href="/triggers">
                <Button variant="gradient" size="lg" className="rounded-xl gap-2">
                  <Plus className="size-4" />
                  {d.createFirstTrigger}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="mt-4">
              {/* Card-based list instead of table for visual richness */}
              <div className="divide-y divide-border/40">
                {recentCompanies.map((c, idx) => {
                  const color = companyColors[idx % companyColors.length];
                  const initials = c.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <Link
                      key={`${c.vat}-${idx}`}
                      href={`/company/${c.vat}`}
                      className="flex items-center gap-4 px-5 sm:px-6 py-4 hover:bg-muted/40 transition-colors group"
                    >
                      {/* Avatar */}
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm", color.bg)}>
                        <span className={cn("text-xs font-bold", color.text)}>
                          {initials}
                        </span>
                      </div>

                      {/* Company info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {c.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {c.industry && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{c.industry}</span>
                          )}
                        </div>
                      </div>

                      {/* Trigger name badge */}
                      {c.triggerName && (
                        <Badge variant="secondary" className="hidden sm:flex text-[10px] bg-blue-50 text-blue-600 border-0 gap-1 shrink-0">
                          <Zap className="size-2.5" />
                          {c.triggerName}
                        </Badge>
                      )}

                      {/* Date */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums shrink-0">
                        <Calendar className="size-3 hidden sm:block" />
                        {new Date(c.date).toLocaleDateString(
                          locale === "da" ? "da-DK" : "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </div>

                      <ArrowRight className="size-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </DashboardLayout>
    </VideoTrigger>
  );
}
