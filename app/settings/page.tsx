"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
        checked ? "bg-blue-600" : "bg-slate-200"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { t, locale, toggleLocale } = useLanguage();
  const { data: session } = useSession();
  const st = t.settings;

  const [name, setName] = useState(session?.user?.name || "");
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [triggerAlerts, setTriggerAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const userEmail = session?.user?.email || "";
  const initials = (session?.user?.name || userEmail)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DashboardLayout>
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl text-sm font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-400 text-lg">
            check_circle
          </span>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)]">
          {st.title}
        </h1>
        <p className="text-sm text-slate-400 mt-1">{st.subtitle}</p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-slate-400 text-xl">
              person
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {st.profile.title}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shrink-0 ring-4 ring-slate-100 shadow-lg">
              {initials}
            </div>
            <div className="flex-1 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                    {st.profile.name}
                  </label>
                  <input
                    className="w-full bg-slate-50 border-none rounded-lg py-3 px-4 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                    {st.profile.email}
                  </label>
                  <input
                    className="w-full bg-slate-50 border-none rounded-lg py-3 px-4 text-sm text-slate-400 cursor-not-allowed"
                    value={userEmail}
                    disabled
                  />
                </div>
              </div>
              <button
                onClick={() => showToast(st.saved)}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-full hover:scale-[1.02] transition-all shadow-sm"
              >
                {st.profile.save}
              </button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-slate-400 text-xl">
              notifications
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {st.notifications.title}
            </h2>
          </div>

          <div className="space-y-5">
            {[
              {
                label: st.notifications.email,
                desc: st.notifications.emailDesc,
                checked: emailNotifs,
                onChange: setEmailNotifs,
              },
              {
                label: st.notifications.triggers,
                desc: st.notifications.triggersDesc,
                checked: triggerAlerts,
                onChange: setTriggerAlerts,
              },
              {
                label: st.notifications.weekly,
                desc: st.notifications.weeklyDesc,
                checked: weeklyReport,
                onChange: setWeeklyReport,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                </div>
                <Toggle checked={item.checked} onChange={item.onChange} />
              </div>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-slate-400 text-xl">
              language
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {st.language.title}
            </h2>
          </div>

          <div className="space-y-1.5 max-w-xs">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              {st.language.label}
            </label>
            <div className="flex bg-slate-50 rounded-full p-1 gap-1">
              <button
                onClick={() => locale !== "da" && toggleLocale()}
                className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
                  locale === "da"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {st.language.danish}
              </button>
              <button
                onClick={() => locale !== "en" && toggleLocale()}
                className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
                  locale === "en"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {st.language.english}
              </button>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-slate-400 text-xl">
              credit_card
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {st.subscription.title}
            </h2>
          </div>

          <div className="bg-slate-50 rounded-xl p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider">
                  {st.subscription.plan}
                </span>
                <span className="text-lg font-black text-slate-900">
                  {st.subscription.price}
                </span>
              </div>
              <button className="self-start px-5 py-2.5 border-2 border-blue-600 rounded-full text-sm font-medium text-blue-600 hover:bg-blue-600 hover:text-white transition-colors">
                {st.subscription.upgrade}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">
                  3.241 / 5.000 {st.subscription.usage}
                </span>
                <span className="font-bold text-slate-700">65%</span>
              </div>
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all"
                  style={{ width: "65%" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-red-50/50 rounded-2xl border border-red-100 p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-red-500 text-xl">
              warning
            </span>
            <h2 className="text-sm font-bold text-red-700 uppercase tracking-wider">
              {st.danger.title}
            </h2>
          </div>
          <p className="text-sm text-red-600/70 mb-4">{st.danger.warning}</p>
          <button className="px-5 py-2.5 border-2 border-red-500 text-red-600 font-bold text-sm rounded-full hover:bg-red-500 hover:text-white transition-colors">
            {st.danger.delete}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
