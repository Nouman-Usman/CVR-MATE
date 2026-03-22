"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import { useSession } from "@/lib/auth-client";
import { LogoFull } from "@/components/logo";

export default function Home() {
  const { locale, t, toggleLocale } = useLanguage();
  const { data: session } = useSession();
  const isLoggedIn = !!session;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: t.nav.home, href: "#", active: true },
    { label: t.nav.howItWorks, href: "#how-it-works" },
    { label: t.nav.integrations, href: "#" },
    { label: t.nav.pricing, href: "#pricing" },
    { label: t.nav.aboutAiMate, href: "#" },
  ];

  return (
    <>
      {/* 1. NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20">
          <LogoFull size="small" />

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                className={`font-bold tracking-tight text-sm font-[family-name:var(--font-manrope)] ${
                  link.active
                    ? "text-blue-600 border-b-2 border-blue-600 pb-1"
                    : "text-slate-600 hover:text-blue-600 transition-colors"
                }`}
                href={link.href}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={toggleLocale}
              className="text-slate-600 hover:bg-slate-50 p-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">language</span>
              <span className="text-xs font-bold uppercase tracking-widest font-[family-name:var(--font-manrope)]">
                {locale === "da" ? "EN" : "DA"}
              </span>
            </button>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-bold text-sm hover:scale-[1.02] transition-all duration-200"
              >
                <span className="material-symbols-outlined text-lg">dashboard</span>
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden sm:block font-bold text-sm text-slate-600 px-4 font-[family-name:var(--font-manrope)]">
                  {t.nav.login}
                </Link>
                <Link href="/signup" className="hidden sm:block bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-bold text-sm hover:scale-[1.02] transition-all duration-200">
                  {t.nav.getStarted}
                </Link>
              </>
            )}

            {/* Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <span className="material-symbols-outlined text-2xl">
                {mobileMenuOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-100 px-4 pb-6 pt-2 shadow-lg">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  className={`py-3 px-4 rounded-lg font-bold text-sm font-[family-name:var(--font-manrope)] ${
                    link.active
                      ? "text-blue-600 bg-blue-50"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg font-bold text-sm text-center block"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className="w-full py-3 text-slate-600 font-bold text-sm rounded-lg border border-slate-200 text-center block">
                    {t.nav.login}
                  </Link>
                  <Link href="/signup" className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg font-bold text-sm text-center block">
                    {t.nav.getStarted}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* 2. HERO */}
      <section className="relative pt-24 sm:pt-32 pb-12 sm:pb-20 overflow-hidden hero-pattern">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100/50 rounded-full border border-blue-100">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                {t.hero.badge}
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-manrope)] text-3xl sm:text-5xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
              {t.hero.headline}
            </h1>
            <p className="text-base sm:text-xl text-slate-500 max-w-xl leading-relaxed">
              {t.hero.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg hover:shadow-lg hover:shadow-blue-500/20 transition-all w-full sm:w-auto">
                {t.hero.bookDemo}
              </button>
              <button className="bg-white border border-slate-200 text-slate-900 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg hover:bg-slate-50 transition-all w-full sm:w-auto">
                {t.hero.explorePlatform}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 sm:pt-6">
              {t.hero.pills.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-sm text-slate-500"
                >
                  <span
                    className="material-symbols-outlined text-blue-600"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* CSS-built Dashboard Mockup */}
          <div className="relative mt-8 lg:mt-0">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-3 sm:p-4 relative z-10">
              <div className="flex items-center justify-between mb-4 sm:mb-6 px-2">
                <div className="flex gap-1.5 sm:gap-2">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="h-5 sm:h-6 w-24 sm:w-32 bg-slate-100 rounded-full" />
              </div>
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="h-20 sm:h-24 bg-slate-50 rounded-lg p-2 sm:p-3 flex flex-col justify-between">
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      {t.hero.dashNewLeads}
                    </span>
                    <span className="text-base sm:text-xl font-black text-blue-600">
                      1.284
                    </span>
                    <div className="h-1 bg-blue-100 rounded-full w-full overflow-hidden">
                      <div className="h-full bg-blue-600 w-2/3" />
                    </div>
                  </div>
                  <div className="h-20 sm:h-24 bg-slate-50 rounded-lg p-2 sm:p-3 flex flex-col justify-between">
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      {t.hero.dashGrowth}
                    </span>
                    <span className="text-base sm:text-xl font-black text-cyan-600">
                      +24%
                    </span>
                    <div className="flex items-end gap-0.5 sm:gap-1 h-4">
                      <div className="w-1 bg-cyan-500 rounded-t h-2" />
                      <div className="w-1 bg-cyan-500 rounded-t h-3" />
                      <div className="w-1 bg-cyan-500 rounded-t h-4" />
                      <div className="w-1 bg-cyan-500 rounded-t h-3" />
                    </div>
                  </div>
                  <div className="h-20 sm:h-24 bg-slate-50 rounded-lg p-2 sm:p-3 flex flex-col justify-between">
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      {t.hero.dashExport}
                    </span>
                    <span className="material-symbols-outlined text-slate-400 text-base sm:text-2xl">
                      sync
                    </span>
                    <span className="text-[8px] sm:text-[10px] text-slate-500">
                      {t.hero.dashAutoSync}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 sm:p-4">
                  <div className="flex justify-between items-center mb-3 sm:mb-4">
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      {t.hero.dashTopCompanies}
                    </span>
                    <span className="text-[10px] text-blue-600 font-bold">
                      {t.hero.dashSeeAll}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-slate-200 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            Novo Nordisk A/S
                          </p>
                          <p className="text-[9px] sm:text-[10px] text-slate-500">
                            Medicinal • 20.000+
                          </p>
                        </div>
                      </div>
                      <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-green-100 text-[8px] sm:text-[10px] font-bold text-green-700 shrink-0 ml-2">
                        HIGH SCORE
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-slate-200 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            Maersk Line
                          </p>
                          <p className="text-[9px] sm:text-[10px] text-slate-500">
                            Transport • 10.000+
                          </p>
                        </div>
                      </div>
                      <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-100 text-[8px] sm:text-[10px] font-bold text-blue-700 shrink-0 ml-2">
                        RELEVANT
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Floating stat card */}
            <div className="absolute -bottom-4 -right-2 sm:-bottom-6 sm:-right-6 bg-white/70 backdrop-blur-xl border border-white p-4 sm:p-6 rounded-2xl shadow-xl z-20 max-w-[160px] sm:max-w-[200px]">
              <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined text-sm sm:text-base">
                    trending_up
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-slate-900">+420%</p>
              </div>
              <p className="text-[9px] sm:text-xs font-bold text-slate-500 leading-tight">
                {t.hero.stat}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FEATURES */}
      <section className="py-16 sm:py-24 bg-[#f7f9fb]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16 space-y-3 sm:space-y-4">
            <h2 className="font-[family-name:var(--font-manrope)] text-2xl sm:text-4xl font-extrabold text-slate-900">
              {t.features.title}
            </h2>
            <p className="text-base sm:text-lg text-slate-500">{t.features.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <div className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-100 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600 mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <span
                  className="material-symbols-outlined text-2xl sm:text-3xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  database
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-900">
                {t.features.card1Title}
              </h3>
              <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                {t.features.card1Desc}
              </p>
            </div>
            <div className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-100 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-cyan-600/10 flex items-center justify-center text-cyan-600 mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <span
                  className="material-symbols-outlined text-2xl sm:text-3xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  radar
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-900">
                {t.features.card2Title}
              </h3>
              <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                {t.features.card2Desc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. TWO PRODUCTS */}
      <section className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="font-[family-name:var(--font-manrope)] text-2xl sm:text-4xl font-extrabold text-slate-900">
              {t.products.title}
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
            {/* GO */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-12 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6 sm:mb-8">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black mb-2 text-slate-900">
                      {t.products.go.name}
                    </h3>
                    <span className="px-3 py-1 bg-slate-100 text-[10px] font-bold rounded-full text-slate-600 uppercase tracking-widest border border-slate-200">
                      {t.products.go.badge}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-3xl sm:text-4xl text-blue-600">
                    rocket_launch
                  </span>
                </div>
                <ul className="space-y-3 sm:space-y-4 mb-8 sm:mb-10">
                  {t.products.go.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm sm:text-base text-slate-500">
                      <span className="material-symbols-outlined text-blue-600 text-sm mt-0.5 shrink-0">
                        check
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <button className="w-full py-3.5 sm:py-4 border-2 border-blue-600 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors text-sm sm:text-base">
                {t.products.go.cta}
              </button>
            </div>
            {/* FLOW */}
            <div className="relative rounded-2xl sm:rounded-3xl p-[2px] bg-gradient-to-br from-blue-600 to-cyan-500 shadow-2xl overflow-hidden">
              <div className="bg-white rounded-[calc(1rem-2px)] sm:rounded-[calc(1.5rem-2px)] p-6 sm:p-12 h-full flex flex-col justify-between relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6 sm:mb-8">
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-black mb-2 text-slate-900">
                        {t.products.flow.name}
                      </h3>
                      <span className="px-3 py-1 bg-cyan-500 text-[10px] font-bold rounded-full text-white uppercase tracking-widest">
                        {t.products.flow.badge}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-3xl sm:text-4xl text-cyan-600">
                      waves
                    </span>
                  </div>
                  <ul className="space-y-3 sm:space-y-4 mb-8 sm:mb-10">
                    {t.products.flow.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm sm:text-base text-slate-500">
                        <span className="material-symbols-outlined text-cyan-600 text-sm mt-0.5 shrink-0">
                          check
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <button className="relative z-10 w-full py-3.5 sm:py-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform text-sm sm:text-base">
                  {t.products.flow.cta}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. BENEFITS */}
      <section className="py-16 sm:py-24 bg-[#f7f9fb]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-10 sm:mb-16">
            <h2 className="font-[family-name:var(--font-manrope)] text-2xl sm:text-4xl font-extrabold text-slate-900">
              {t.benefits.title}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-12 sm:mb-20">
            {t.benefits.items.map((item) => (
              <div
                key={item.title}
                className="p-6 sm:p-8 bg-slate-50 rounded-2xl border border-slate-100"
              >
                <span className="material-symbols-outlined text-blue-600 mb-3 sm:mb-4 block text-2xl sm:text-3xl">
                  {item.icon}
                </span>
                <h4 className="font-bold text-lg sm:text-xl mb-2 text-slate-900">
                  {item.title}
                </h4>
                <p className="text-xs sm:text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
          {/* Quote */}
          <div className="relative bg-blue-600 rounded-2xl sm:rounded-3xl p-6 sm:p-12 overflow-hidden">
            <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-10">
              <span className="material-symbols-outlined text-[6rem] sm:text-[12rem] text-white">
                format_quote
              </span>
            </div>
            <div className="relative z-10 max-w-2xl">
              <p className="text-lg sm:text-2xl md:text-3xl font-bold text-white leading-relaxed mb-6 sm:mb-8">
                &ldquo;{t.benefits.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm sm:text-lg shrink-0">
                  MJ
                </div>
                <div>
                  <p className="font-bold text-white text-sm sm:text-base">{t.benefits.quoteName}</p>
                  <p className="text-blue-200 text-xs sm:text-sm">
                    {t.benefits.quoteRole}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. HOW IT WORKS */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-slate-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-12 sm:mb-20 text-center sm:text-left">
            <h2 className="font-[family-name:var(--font-manrope)] text-2xl sm:text-4xl font-extrabold mb-3 sm:mb-4">
              {t.howItWorks.title}
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">{t.howItWorks.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-12 relative">
            <div className="hidden md:block absolute top-10 left-0 w-full h-1 bg-gradient-to-r from-blue-600/30 to-cyan-500/30" />
            {t.howItWorks.steps.map((step, i) => (
              <div key={step.num} className="space-y-4 sm:space-y-6">
                <div
                  className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full flex items-center justify-center relative mx-auto sm:mx-0 ${
                    i === 3
                      ? "bg-gradient-to-br from-blue-600 to-cyan-500"
                      : "bg-slate-800 border-4 border-slate-900"
                  } ${
                    i === 0
                      ? "shadow-[0_0_30px_rgba(37,99,235,0.2)]"
                      : i === 1
                        ? "shadow-[0_0_30px_rgba(57,184,253,0.2)]"
                        : ""
                  }`}
                >
                  <span
                    className={`text-lg sm:text-2xl font-black ${
                      i === 0
                        ? "text-blue-500"
                        : i === 1
                          ? "text-cyan-400"
                          : "text-white"
                    }`}
                  >
                    {step.num}
                  </span>
                </div>
                <div className="text-center sm:text-left">
                  <h5 className="text-base sm:text-xl font-bold mb-1 sm:mb-3">{step.title}</h5>
                  <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. COMPARISON TABLE */}
      <section className="py-16 sm:py-24 bg-[#f7f9fb]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="font-[family-name:var(--font-manrope)] text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8 sm:mb-12">
            {t.comparison.title}
          </h2>
          <div className="bg-white rounded-2xl overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[400px]">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="p-4 sm:p-6 font-bold text-xs sm:text-sm text-slate-700">
                      {t.comparison.feature}
                    </th>
                    <th className="p-4 sm:p-6 font-bold text-xs sm:text-sm text-center text-slate-700">
                      {t.comparison.traditional}
                    </th>
                    <th className="p-4 sm:p-6 font-bold text-xs sm:text-sm text-center text-blue-600 bg-blue-50/50">
                      {t.comparison.cvrmate}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {t.comparison.rows.map((row) => (
                    <tr key={row.feature}>
                      <td className="p-4 sm:p-6 text-xs sm:text-sm font-medium text-slate-700">
                        {row.feature}
                      </td>
                      <td className="p-4 sm:p-6 text-center text-slate-400">
                        <span className="material-symbols-outlined text-red-400 text-lg sm:text-2xl">
                          close
                        </span>
                      </td>
                      <td className="p-4 sm:p-6 text-center text-emerald-500 bg-blue-50/50">
                        <span className="material-symbols-outlined text-lg sm:text-2xl">
                          check_circle
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 8. PRICING */}
      <section id="pricing" className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16 space-y-3 sm:space-y-4">
            <h2 className="font-[family-name:var(--font-manrope)] text-2xl sm:text-4xl font-extrabold text-slate-900">
              {t.pricing.title}
            </h2>
            <p className="text-sm sm:text-base text-slate-500">{t.pricing.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
            {/* GO */}
            <div className="bg-white p-6 sm:p-10 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-lg sm:text-xl font-bold mb-2 text-slate-900">
                {t.pricing.go.name}
              </h3>
              <div className="flex items-baseline gap-1 mb-4 sm:mb-6">
                <span className="text-3xl sm:text-4xl font-black text-slate-900">
                  {t.pricing.go.price}
                </span>
                <span className="text-sm sm:text-base text-slate-500 font-bold">
                  {t.pricing.go.period}
                </span>
              </div>
              <ul className="space-y-3 sm:space-y-4 mb-8 sm:mb-10 text-xs sm:text-sm text-slate-500">
                {t.pricing.go.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-sm shrink-0">
                      check
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3.5 sm:py-4 border border-slate-200 font-bold rounded-xl hover:bg-slate-50 transition-all text-slate-700 text-sm sm:text-base">
                {t.pricing.go.cta}
              </button>
            </div>
            {/* FLOW */}
            <div className="bg-white p-6 sm:p-10 rounded-2xl sm:rounded-3xl border-2 border-blue-600 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 sm:px-4 py-1 uppercase tracking-widest rounded-bl-xl">
                {t.pricing.flow.recommended}
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-2 text-slate-900">
                {t.pricing.flow.name}
              </h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl sm:text-4xl font-black text-slate-900">
                  {t.pricing.flow.price}
                </span>
                <span className="text-sm sm:text-base text-slate-500 font-bold">
                  {t.pricing.flow.period}
                </span>
              </div>
              <p className="text-xs text-blue-600 font-bold mb-4 sm:mb-6">
                {t.pricing.flow.setup}
              </p>
              <ul className="space-y-3 sm:space-y-4 mb-8 sm:mb-10 text-xs sm:text-sm text-slate-500">
                {t.pricing.flow.features.map((f) => (
                  <li
                    key={f}
                    className={`flex gap-2 ${f === t.pricing.flow.featureHighlight ? "font-bold text-slate-900" : ""}`}
                  >
                    <span className="material-symbols-outlined text-blue-600 text-sm shrink-0">
                      check
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3.5 sm:py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all text-sm sm:text-base">
                {t.pricing.flow.cta}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 9. TRUST */}
      <section className="py-12 sm:py-16 bg-[#f7f9fb] border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 text-center">
          {t.trust.items.map((item) => (
            <div key={item.title} className="flex flex-col items-center">
              <span className="material-symbols-outlined text-3xl sm:text-4xl text-slate-300 mb-3 sm:mb-4">
                {item.icon}
              </span>
              <p className="font-bold text-slate-900 text-sm sm:text-base">{item.title}</p>
              <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 10. FINAL CTA */}
      <section className="py-16 sm:py-32 bg-white relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern opacity-50" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <h2 className="font-[family-name:var(--font-manrope)] text-2xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 mb-6 sm:mb-8">
            {t.cta.title}
          </h2>
          <p className="text-base sm:text-xl text-slate-500 mb-8 sm:mb-12 max-w-2xl mx-auto">
            {t.cta.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <button className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black text-base sm:text-xl hover:scale-105 transition-transform shadow-xl shadow-blue-500/20">
              {t.cta.button1}
            </button>
            <button className="bg-white border-2 border-slate-200 text-slate-900 px-6 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black text-base sm:text-xl hover:bg-slate-50 transition-colors">
              {t.cta.button2}
            </button>
          </div>
          <p className="mt-6 sm:mt-8 text-xs sm:text-sm text-slate-400">{t.cta.note}</p>
        </div>
      </section>

      {/* 11. FOOTER */}
      <footer className="bg-slate-900 pt-12 sm:pt-16 pb-8 text-slate-400 text-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="col-span-2 md:col-span-1 space-y-4">
            <LogoFull size="small" variant="dark" />
            <p className="text-slate-500 leading-relaxed text-xs sm:text-sm">
              {t.footer.tagline}
            </p>
          </div>
          <div className="space-y-4">
            <h6 className="text-white font-bold uppercase tracking-widest text-xs">
              {t.footer.platform}
            </h6>
            <ul className="space-y-2">
              {t.footer.platformLinks.map((link) => (
                <li key={link}>
                  <a className="hover:text-blue-400 transition-colors opacity-80 text-xs sm:text-sm" href="#">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <h6 className="text-white font-bold uppercase tracking-widest text-xs">
              {t.footer.resources}
            </h6>
            <ul className="space-y-2">
              {t.footer.resourceLinks.map((link) => (
                <li key={link}>
                  <a className="hover:text-blue-400 transition-colors opacity-80 text-xs sm:text-sm" href="#">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4 col-span-2 md:col-span-1">
            <h6 className="text-white font-bold uppercase tracking-widest text-xs">
              {t.footer.contact}
            </h6>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="material-symbols-outlined text-xs">mail</span>
                kontakt@ai-mate.dk
              </li>
              <li className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="material-symbols-outlined text-xs">location_on</span>
                København, Danmark
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-10 sm:mt-16 pt-6 sm:pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs sm:text-sm">{t.footer.rights}</p>
          <div className="flex gap-6 sm:gap-8">
            <a className="hover:text-white transition-colors text-xs sm:text-sm" href="#">
              {t.footer.privacy}
            </a>
            <a className="hover:text-white transition-colors text-xs sm:text-sm" href="#">
              {t.footer.terms}
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
