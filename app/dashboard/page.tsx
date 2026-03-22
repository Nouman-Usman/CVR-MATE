"use client";

import { useLanguage } from "@/lib/i18n/language-context";
import { useSession } from "@/lib/auth-client";
import DashboardLayout from "@/components/dashboard-layout";

const weeklyData = [12, 19, 8, 24, 15, 3, 1];
const maxWeekly = Math.max(...weeklyData);

const mockCompanies = [
  { name: "Nordic Health ApS", industry: "Sundhed", employees: "12", score: "HIGH", date: "2026-03-22" },
  { name: "GreenBuild Danmark A/S", industry: "Byggeri", employees: "85", score: "HIGH", date: "2026-03-22" },
  { name: "DataFlow Solutions", industry: "IT & Software", employees: "34", score: "MEDIUM", date: "2026-03-21" },
  { name: "Scandi Logistics ApS", industry: "Transport", employees: "200+", score: "HIGH", date: "2026-03-21" },
  { name: "CleanTech Nordic", industry: "Energi", employees: "18", score: "MEDIUM", date: "2026-03-20" },
];

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

  const stats = [
    { label: d.newToday, value: "47", icon: "apartment", color: "bg-blue-50 text-blue-600", trend: "+12%", trendUp: true },
    { label: d.newThisWeek, value: "312", icon: "trending_up", color: "bg-emerald-50 text-emerald-600", trend: "+8%", trendUp: true },
    { label: d.activeTriggers, value: "8", icon: "bolt", color: "bg-amber-50 text-amber-600", trend: "+2", trendUp: true },
    { label: d.savedSearches, value: "12", icon: "search", color: "bg-blue-50 text-blue-600", trend: "0%", trendUp: false },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)]">
          {d.title}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {d.subtitle}, {session?.user?.name?.split(" ")[0] || session?.user?.email}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-4 sm:p-6">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.color}`}>
                <span className="material-symbols-outlined text-xl">{stat.icon}</span>
              </div>
              {stat.trendUp ? (
                <div className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                  {stat.trend}
                </div>
              ) : (
                <div className="flex items-center text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
                  {stat.trend}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium mb-1">{stat.label}</p>
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums font-[family-name:var(--font-manrope)]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Chart + Quick access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-4 sm:p-6 md:p-8">
          <h3 className="text-sm font-bold text-slate-900 mb-6">{d.weeklyChart}</h3>
          <div className="flex items-end gap-2 sm:gap-4 h-[180px] sm:h-[220px]">
            {weeklyData.map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <span className="text-[10px] font-bold text-slate-400 tabular-nums">{val}</span>
                <div className="w-full flex justify-center">
                  <div
                    className="w-full max-w-[40px] rounded-t-xl transition-all duration-300 group-hover:shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                    style={{
                      height: `${(val / maxWeekly) * 160}px`,
                      background: "linear-gradient(to top, #2563eb, #39b8fd)",
                    }}
                  />
                </div>
                <span className="text-[10px] sm:text-xs font-medium text-slate-400">{d.days[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-4 sm:p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-4">{d.quickAccess}</h3>
          <div className="space-y-2">
            {[
              { label: d.createTrigger, icon: "add_circle" },
              { label: d.savedSearchesLink, icon: "bookmark" },
              { label: d.exportLeads, icon: "download" },
            ].map((item) => (
              <button
                key={item.label}
                className="w-full flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-white border border-slate-100/60 hover:bg-blue-600 transition-all duration-300 text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-white/20 transition-colors duration-300">
                    <span className="material-symbols-outlined text-blue-600 text-lg group-hover:text-white transition-colors duration-300">{item.icon}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-white transition-colors duration-300">{item.label}</span>
                </div>
                <span className="material-symbols-outlined text-slate-300 text-lg group-hover:text-white group-hover:translate-x-1 transition-all duration-300">
                  chevron_right
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent results table */}
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 overflow-hidden">
        <div className="p-4 sm:p-6 pb-0">
          <h3 className="text-sm font-bold text-slate-900 mb-4">{d.recentTriggers}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 sm:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{d.company}</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{d.industry}</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{d.employees}</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{d.score}</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{d.date}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {mockCompanies.map((c, idx) => {
                const color = companyColors[idx % companyColors.length];
                const initials = c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <tr key={c.name} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 sm:px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full ${color.bg} flex items-center justify-center shrink-0`}>
                          <span className={`text-xs font-bold ${color.text}`}>{initials}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-500">{c.industry}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-500 tabular-nums">{c.employees}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.score === "HIGH" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                        {c.score}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-400 tabular-nums">
                      {new Date(c.date).toLocaleDateString(locale === "da" ? "da-DK" : "en-US")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
