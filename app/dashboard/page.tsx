"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import { useSession } from "@/lib/auth-client";
import DashboardLayout from "@/components/dashboard-layout";
import { useDashboard } from "@/lib/hooks/use-dashboard";

const companyColors = [
  { bg: "bg-blue-100", text: "text-blue-600" },
  { bg: "bg-amber-100", text: "text-amber-600" },
  { bg: "bg-violet-100", text: "text-violet-600" },
  { bg: "bg-cyan-100", text: "text-cyan-600" },
];

export default function DashboardPage() {
  const { t, locale } = useLanguage();
  const { data: session } = useSession();
  const d = t.dashboard;

  const { data, isLoading } = useDashboard();
  const stats = data?.stats;
  const weeklyActivity = data?.weeklyActivity ?? [0, 0, 0, 0, 0, 0, 0];
  const recentCompanies = data?.recentCompanies ?? [];

  const maxWeekly = Math.max(...weeklyActivity, 1);

  const statCards = [
    {
      label: d.savedSearches,
      value: stats?.savedSearches ?? "–",
      icon: "saved_search",
      color: "bg-blue-50 text-blue-600",
      href: "/saved-searches",
    },
    {
      label: d.activeTriggers,
      value: stats?.activeTriggers ?? "–",
      icon: "bolt",
      color: "bg-amber-50 text-amber-600",
      href: "/triggers",
    },
    {
      label: t.saved.title,
      value: stats?.savedCompanies ?? "–",
      icon: "bookmark",
      color: "bg-emerald-50 text-emerald-600",
      href: "/saved",
    },
    {
      label: t.todos.activeTasks,
      value: stats?.activeTasks ?? "–",
      icon: "task_alt",
      color: "bg-violet-50 text-violet-600",
      href: "/todos",
    },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)]">
          {d.title}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {d.subtitle},{" "}
          {session?.user?.name?.split(" ")[0] || session?.user?.email}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {statCards.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-4 sm:p-6 group"
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.color}`}
              >
                <span className="material-symbols-outlined text-xl">
                  {stat.icon}
                </span>
              </div>
              <span className="material-symbols-outlined text-slate-300 text-lg group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all">
                arrow_forward
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mb-1">
              {stat.label}
            </p>
            {isLoading ? (
              <div className="h-8 w-12 bg-slate-100 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums font-[family-name:var(--font-manrope)]">
                {stat.value}
              </p>
            )}
          </Link>
        ))}
      </div>

      {/* Chart + Quick access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-4 sm:p-6 md:p-8">
          <h3 className="text-sm font-bold text-slate-900 mb-6">
            {d.weeklyChart}
          </h3>
          <div className="flex items-end gap-2 sm:gap-4 h-[180px] sm:h-[220px]">
            {weeklyActivity.map((val, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-2 group"
              >
                <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                  {isLoading ? "" : val}
                </span>
                <div className="w-full flex justify-center">
                  {isLoading ? (
                    <div className="w-full max-w-[40px] h-16 rounded-t-xl bg-slate-100 animate-pulse" />
                  ) : (
                    <div
                      className="w-full max-w-[40px] rounded-t-xl transition-all duration-500 group-hover:shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                      style={{
                        height: `${Math.max((val / maxWeekly) * 160, 4)}px`,
                        background:
                          val > 0
                            ? "linear-gradient(to top, #2563eb, #39b8fd)"
                            : "#e2e8f0",
                      }}
                    />
                  )}
                </div>
                <span className="text-[10px] sm:text-xs font-medium text-slate-400">
                  {d.days[i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-4 sm:p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-4">
            {d.quickAccess}
          </h3>
          <div className="space-y-2">
            {[
              {
                label: d.createTrigger,
                icon: "add_circle",
                href: "/triggers",
              },
              {
                label: d.savedSearchesLink,
                icon: "bookmark",
                href: "/saved-searches",
              },
              {
                label: d.exportLeads,
                icon: "download",
                href: "/exports",
              },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="w-full flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-white border border-slate-100/60 hover:bg-blue-600 transition-all duration-300 text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-white/20 transition-colors duration-300">
                    <span className="material-symbols-outlined text-blue-600 text-lg group-hover:text-white transition-colors duration-300">
                      {item.icon}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-white transition-colors duration-300">
                    {item.label}
                  </span>
                </div>
                <span className="material-symbols-outlined text-slate-300 text-lg group-hover:text-white group-hover:translate-x-1 transition-all duration-300">
                  chevron_right
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent trigger results */}
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 overflow-hidden">
        <div className="p-4 sm:p-6 pb-0">
          <h3 className="text-sm font-bold text-slate-900 mb-4">
            {d.recentTriggers}
          </h3>
        </div>

        {isLoading ? (
          <div className="px-6 pb-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-14 bg-slate-50 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : recentCompanies.length === 0 ? (
          <div className="py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-200 mb-2 block">
              bolt
            </span>
            <p className="text-slate-400 font-medium text-sm mb-4">
              {d.noResults}
            </p>
            <Link
              href="/triggers"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-full hover:scale-[1.02] transition-all"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              {d.createFirstTrigger}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 sm:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {d.company}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {d.industry}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">
                    Trigger
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {d.date}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentCompanies.map((c, idx) => {
                  const color = companyColors[idx % companyColors.length];
                  const initials = c.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <tr
                      key={`${c.vat}-${idx}`}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => {
                        window.location.href = `/company/${c.vat}`;
                      }}
                    >
                      <td className="px-4 sm:px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full ${color.bg} flex items-center justify-center shrink-0`}
                          >
                            <span
                              className={`text-xs font-bold ${color.text}`}
                            >
                              {initials}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {c.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 truncate max-w-[160px]">
                        {c.industry || "–"}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 truncate max-w-[140px] hidden md:table-cell">
                        {c.triggerName || "–"}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 tabular-nums">
                        {new Date(c.date).toLocaleDateString(
                          locale === "da" ? "da-DK" : "en-US"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
