"use client";
/* eslint-disable @next/next/no-img-element */

import { useLanguage } from "@/lib/i18n/language-context";

const benefitIcons = [
  "timeline",
  "refresh",
  "schedule",
  "hub",
  "precision_manufacturing",
  "rocket_launch",
];

const trustIcons = ["verified_user", "account_tree", "rocket"];

export default function Home() {
  const { locale, t, toggleLocale } = useLanguage();

  return (
    <>
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="flex justify-between items-center px-8 py-4 max-w-screen-2xl mx-auto">
          <div className="text-2xl font-black tracking-tighter text-slate-900 uppercase font-[family-name:var(--font-manrope)]">
            CVR-MATE
          </div>
          <div className="hidden md:flex gap-8 items-center">
            <a
              className="font-bold tracking-tight text-sm text-blue-600 border-b-2 border-blue-500 pb-1"
              href="#"
            >
              {t.nav.home}
            </a>
            {[
              { label: t.nav.howItWorks, href: "#how-it-works" },
              { label: t.nav.integrations, href: "#" },
              { label: t.nav.pricing, href: "#pricing" },
              { label: t.nav.aboutAiMate, href: "#" },
            ].map((link) => (
              <a
                key={link.label}
                className="font-bold tracking-tight text-sm text-slate-500 hover:text-slate-900 transition-colors px-3 py-2 hover:bg-slate-100 rounded-lg"
                href={link.href}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={toggleLocale}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-slate-100"
            >
              <span className="material-symbols-outlined text-sm">
                language
              </span>
              <span className="text-xs font-bold uppercase tracking-widest">
                {locale === "da" ? "EN" : "DA"}
              </span>
            </button>
            <a
              className="text-slate-500 hover:text-slate-900 text-sm font-bold"
              href="#"
            >
              {t.nav.login}
            </a>
            <button className="btn-primary px-6 py-2.5 rounded-xl text-sm font-bold shadow-[0_4px_20px_rgba(37,99,235,0.25)]">
              {t.nav.getStarted}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-44 pb-32 overflow-hidden bg-gradient-to-b from-blue-50/50 to-white">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140%] h-[800px] bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.06)_0%,transparent_70%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-8 relative z-10 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full bg-blue-50 text-blue-600 font-bold text-xs tracking-widest uppercase mb-6 border border-blue-100">
              {t.hero.badge}
            </span>
            <h1 className="text-6xl md:text-7xl font-black font-[family-name:var(--font-manrope)] tracking-tighter mb-6 leading-[0.95] text-slate-900">
              {t.hero.headline}{" "}
              <span className="text-gradient">{t.hero.headlineHighlight}</span>{" "}
              {t.hero.headlineEnd}
            </h1>
            <p className="text-xl text-slate-500 mb-10 max-w-xl leading-relaxed">
              {t.hero.description}
            </p>
            <div className="flex flex-wrap gap-4 mb-12">
              <button className="btn-primary px-8 py-4 rounded-xl font-bold text-lg flex items-center gap-3">
                {t.hero.bookDemo}
                <span className="material-symbols-outlined">
                  arrow_forward
                </span>
              </button>
              <button className="px-8 py-4 rounded-xl text-slate-700 font-bold text-lg hover:bg-slate-100 transition-all border border-slate-200">
                {t.hero.explorePlatform}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {t.hero.pills.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 text-sm text-slate-600 font-medium"
                >
                  <span
                    className="material-symbols-outlined text-blue-500"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="bg-white rounded-2xl p-4 nebula-shadow transform lg:rotate-2 lg:translate-x-12 scale-110 border border-slate-100">
              <img
                alt="B2B Dashboard"
                className="rounded-xl"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsn76VyIg6ExeYcxz54Bp3DZu9CCKz6nb1yJGF_uXjA8duwqas40t6xJSPHw7v-13Z0dPLY_RRY0XpGDuL2E77R4Bri1B5RrsgprT_WPWXpnSXXXAUiEY7njF_jOiXbe7phTCa9sqxFmhOspGDqCgKg-yat17I_zoOkXyflGyASsbvxNeUTZKLAGmw4zJC3h8NM9SOryeiBwN8mVAetnFyJra5iIaVhCRqEICiBiOYcyV60cEfBnbv6M9T4GSl2Ibu49FS0fp_uA"
              />
              <div className="absolute -top-10 -left-10 bg-white p-6 rounded-2xl nebula-shadow max-w-[200px] border border-blue-100">
                <div className="text-blue-600 text-2xl font-bold mb-1">
                  +420%
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">
                  {t.hero.stat}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 section-alt">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black font-[family-name:var(--font-manrope)] mb-4 text-slate-900">
              {t.features.title}{" "}
              <span className="text-gradient">
                {t.features.titleHighlight}
              </span>
            </h2>
            <p className="text-slate-500 text-lg">{t.features.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-12 rounded-3xl hover:scale-[1.02] transition-transform duration-500 border border-slate-100 shadow-sm">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-8 border border-blue-100">
                <span
                  className="material-symbols-outlined text-blue-600 text-4xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  database
                </span>
              </div>
              <h3 className="text-2xl font-bold mb-4 font-[family-name:var(--font-manrope)] text-slate-900">
                {t.features.card1Title}
              </h3>
              <p className="text-slate-500 leading-relaxed">
                {t.features.card1Desc}
              </p>
            </div>
            <div className="bg-white p-12 rounded-3xl hover:scale-[1.02] transition-transform duration-500 border border-slate-100 shadow-sm">
              <div className="w-16 h-16 bg-cyan-50 rounded-2xl flex items-center justify-center mb-8 border border-cyan-100">
                <span
                  className="material-symbols-outlined text-cyan-600 text-4xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  radar
                </span>
              </div>
              <h3 className="text-2xl font-bold mb-4 font-[family-name:var(--font-manrope)] text-slate-900">
                {t.features.card2Title}
              </h3>
              <p className="text-slate-500 leading-relaxed">
                {t.features.card2Desc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Comparison */}
      <section className="py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-8 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black font-[family-name:var(--font-manrope)] mb-4 text-slate-900">
              {t.products.title}{" "}
              <span className="text-gradient">CVR-MATE</span>
            </h2>
          </div>
          <div className="grid lg:grid-cols-2 gap-12">
            {/* GO Card */}
            <div className="p-1 bg-gradient-to-br from-slate-100 to-transparent rounded-[2.5rem]">
              <div className="bg-white p-12 rounded-[2.3rem] h-full flex flex-col border border-slate-100">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-3xl font-black font-[family-name:var(--font-manrope)] tracking-tighter mb-2 text-slate-900">
                      CVR-MATE{" "}
                      <span className="text-blue-600">{t.products.go.name}</span>
                    </h3>
                    <p className="text-slate-500">{t.products.go.subtitle}</p>
                  </div>
                  <span className="px-4 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold tracking-widest uppercase border border-blue-100">
                    {t.products.go.badge}
                  </span>
                </div>
                <ul className="space-y-6 mb-12 flex-grow">
                  {t.products.go.features.map((item) => (
                    <li key={item} className="flex gap-4 items-start">
                      <span className="material-symbols-outlined text-blue-500 mt-0.5">
                        check
                      </span>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
                <button className="w-full py-5 rounded-2xl border-2 border-blue-200 text-blue-600 font-bold hover:bg-blue-600 hover:text-white transition-all text-lg">
                  {t.products.go.cta}
                </button>
              </div>
            </div>
            {/* FLOW Card */}
            <div className="p-1 bg-gradient-to-br from-blue-200/60 to-cyan-200/60 rounded-[2.5rem] shadow-[0_0_60px_rgba(37,99,235,0.08)]">
              <div className="bg-white p-12 rounded-[2.3rem] h-full flex flex-col relative overflow-hidden border border-blue-50">
                <div className="absolute top-0 right-0 p-8 opacity-10 translate-x-1/4 -translate-y-1/4">
                  <span className="material-symbols-outlined text-[180px] text-cyan-500">
                    waves
                  </span>
                </div>
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-3xl font-black font-[family-name:var(--font-manrope)] tracking-tighter mb-2 text-slate-900">
                      CVR-MATE{" "}
                      <span className="text-cyan-600">
                        {t.products.flow.name}
                      </span>
                    </h3>
                    <p className="text-slate-500">
                      {t.products.flow.subtitle}
                    </p>
                  </div>
                  <span className="px-4 py-1 rounded-full bg-cyan-500 text-white text-xs font-bold tracking-widest uppercase">
                    {t.products.flow.badge}
                  </span>
                </div>
                <ul className="space-y-6 mb-12 flex-grow">
                  {t.products.flow.features.map((item) => (
                    <li key={item} className="flex gap-4 items-start">
                      <span className="material-symbols-outlined text-cyan-500 mt-0.5">
                        bolt
                      </span>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
                <button className="w-full py-5 rounded-2xl btn-primary font-bold text-lg shadow-xl">
                  {t.products.flow.cta}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-24 section-alt">
        <div className="max-w-7xl mx-auto px-8">
          <div className="mb-16 max-w-2xl">
            <h2 className="text-4xl font-black font-[family-name:var(--font-manrope)] mb-6 text-slate-900">
              {t.benefits.title}
            </h2>
            <p className="text-xl text-slate-500">{t.benefits.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            {t.benefits.items.map((item, i) => (
              <div
                key={item.title}
                className="p-8 rounded-2xl hover:bg-white transition-colors border border-transparent hover:border-slate-200 hover:shadow-sm"
              >
                <span
                  className={`material-symbols-outlined ${i % 2 === 0 ? "text-blue-500" : "text-cyan-500"} text-4xl mb-6 block`}
                >
                  {benefitIcons[i]}
                </span>
                <h4 className="text-xl font-bold mb-3 text-slate-900">
                  {item.title}
                </h4>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="bg-white p-10 rounded-3xl border border-blue-100 relative overflow-hidden shadow-sm">
            <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
              <div className="text-5xl font-black font-[family-name:var(--font-manrope)] text-blue-300">
                &ldquo;
              </div>
              <p className="text-2xl font-bold text-center md:text-left leading-relaxed text-slate-700">
                {t.benefits.quote}{" "}
                <span className="text-gradient">
                  {t.benefits.quoteHighlight}
                </span>{" "}
                {t.benefits.quoteEnd}
              </p>
            </div>
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-blue-100/40 blur-[100px] rounded-full" />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32 section-dark">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-4xl font-black font-[family-name:var(--font-manrope)] text-center mb-24 text-white">
            {t.howItWorks.title}{" "}
            <span className="text-gradient">{t.howItWorks.titleHighlight}</span>
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            {t.howItWorks.steps.map((step, i) => (
              <div key={step.num} className="relative group">
                {i > 0 && (
                  <div className="hidden md:block absolute top-10 -left-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                )}
                <div className="mb-8 flex justify-center">
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black font-[family-name:var(--font-manrope)] text-white border ${i % 2 === 0 ? "border-blue-400/40 shadow-[0_0_30px_rgba(37,99,235,0.2)]" : "border-cyan-400/40 shadow-[0_0_30px_rgba(14,165,233,0.2)]"} bg-white/5 backdrop-blur-sm group-hover:scale-110 transition-transform`}
                  >
                    {step.num}
                  </div>
                </div>
                <div className="text-center">
                  <h4 className="text-xl font-bold mb-3 uppercase tracking-tighter text-white">
                    {step.title}
                  </h4>
                  <p className="text-slate-400 text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-8">
          <h2 className="text-4xl font-black font-[family-name:var(--font-manrope)] text-center mb-16 text-slate-900">
            {t.comparison.title}
          </h2>
          <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="p-6 text-sm font-bold uppercase tracking-widest text-slate-400">
                    {t.comparison.feature}
                  </th>
                  <th className="p-6 text-sm font-bold uppercase tracking-widest text-slate-400">
                    {t.comparison.traditional}
                  </th>
                  <th className="p-6 text-sm font-bold uppercase tracking-widest text-blue-600">
                    CVR-MATE
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {t.comparison.rows.map((row) => (
                  <tr key={row.feature}>
                    <td className="p-6 font-semibold text-slate-700">
                      {row.feature}
                    </td>
                    <td className="p-6">
                      {row.traditional === "close" ? (
                        <span className="material-symbols-outlined text-red-400">
                          close
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          {row.traditional}
                        </span>
                      )}
                    </td>
                    <td className="p-6">
                      <span
                        className="material-symbols-outlined text-emerald-500"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 section-alt">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black font-[family-name:var(--font-manrope)] tracking-tighter mb-4 text-slate-900">
              {t.pricing.title}
            </h2>
            <p className="text-slate-500">{t.pricing.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-12 rounded-[2.5rem] flex flex-col items-center text-center border border-slate-200 shadow-sm">
              <h3 className="text-2xl font-bold font-[family-name:var(--font-manrope)] mb-6 text-slate-900">
                {t.pricing.go.name}
              </h3>
              <div className="mb-10">
                <span className="text-5xl font-black tracking-tighter text-slate-900">
                  {t.pricing.go.price}
                </span>
                <span className="text-slate-400 font-bold ml-2">
                  {t.pricing.go.period}
                </span>
              </div>
              <button className="w-full py-4 rounded-xl font-bold hover:bg-slate-50 transition-colors border border-slate-200 text-slate-700">
                {t.pricing.go.cta}
              </button>
            </div>
            <div className="bg-white p-12 rounded-[2.5rem] flex flex-col items-center text-center border-2 border-blue-200 relative shadow-md">
              <div className="absolute -top-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                {t.pricing.flow.recommended}
              </div>
              <h3 className="text-2xl font-bold font-[family-name:var(--font-manrope)] mb-6 text-slate-900">
                {t.pricing.flow.name}
              </h3>
              <div className="mb-4">
                <div className="text-sm text-slate-400 font-bold mb-1">
                  {t.pricing.flow.setup}
                </div>
                <div className="flex items-end justify-center">
                  <span className="text-slate-400 font-bold mr-2">
                    {t.pricing.flow.from}
                  </span>
                  <span className="text-5xl font-black tracking-tighter text-slate-900">
                    {t.pricing.flow.price}
                  </span>
                </div>
                <span className="text-slate-400 font-bold">
                  {t.pricing.flow.period}
                </span>
              </div>
              <button className="w-full py-4 btn-primary rounded-xl font-bold shadow-lg mt-6">
                {t.pricing.flow.cta}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust/Data Foundation */}
      <section className="py-24 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid md:grid-cols-3 gap-12 text-center">
            {t.trust.items.map((item, i) => (
              <div key={item.title}>
                <span
                  className={`material-symbols-outlined text-4xl ${i % 2 === 0 ? "text-blue-500" : "text-cyan-500"} mb-4 block`}
                >
                  {trustIcons[i]}
                </span>
                <h4 className="font-bold mb-2 text-slate-900">{item.title}</h4>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 relative overflow-hidden bg-gradient-to-b from-blue-50/50 to-white">
        <div className="max-w-4xl mx-auto px-8 text-center relative z-10">
          <h2 className="text-6xl font-black font-[family-name:var(--font-manrope)] mb-8 tracking-tighter text-slate-900">
            {t.cta.title}
          </h2>
          <button className="btn-primary px-12 py-6 rounded-2xl font-black text-2xl shadow-2xl hover:scale-105 transition-transform">
            {t.cta.button}
          </button>
          <p className="mt-8 text-slate-500 font-medium">{t.cta.subtitle}</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 w-full pt-20 pb-10 border-t border-slate-800 text-slate-400 text-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12 px-8 max-w-7xl mx-auto">
          <div className="col-span-2">
            <span className="text-xl font-black text-white mb-4 block">
              CVR-MATE
            </span>
            <p className="max-w-xs leading-relaxed mb-8">
              {t.footer.tagline}
            </p>
            <div className="flex gap-4">
              <span className="material-symbols-outlined hover:text-white cursor-pointer transition-colors">
                alternate_email
              </span>
              <span className="material-symbols-outlined hover:text-white cursor-pointer transition-colors">
                public
              </span>
              <span className="material-symbols-outlined hover:text-white cursor-pointer transition-colors">
                share
              </span>
            </div>
          </div>
          <div>
            <h5 className="text-white font-semibold mb-6 uppercase tracking-widest text-xs">
              {t.footer.platform}
            </h5>
            <ul className="space-y-4">
              <li>
                <a className="text-slate-500 hover:text-blue-300 transition-colors block" href="#">
                  CVR-MATE
                </a>
              </li>
              <li>
                <a className="text-slate-500 hover:text-blue-300 transition-colors block" href="#how-it-works">
                  {t.nav.howItWorks}
                </a>
              </li>
              <li>
                <a className="text-slate-500 hover:text-blue-300 transition-colors block" href="#">
                  {t.nav.integrations}
                </a>
              </li>
              <li>
                <a className="text-slate-500 hover:text-blue-300 transition-colors block" href="#">
                  AI-MATE
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="text-white font-semibold mb-6 uppercase tracking-widest text-xs">
              {t.footer.resources}
            </h5>
            <ul className="space-y-4">
              <li>
                <a className="text-slate-500 hover:text-blue-300 transition-colors block" href="#">
                  {t.footer.contact}
                </a>
              </li>
              <li>
                <a className="text-slate-500 hover:text-blue-300 transition-colors block" href="#">
                  {t.footer.bookDemo}
                </a>
              </li>
              <li>
                <a className="text-slate-500 hover:text-blue-300 transition-colors block" href="mailto:kontakt@ai-mate.dk">
                  kontakt@ai-mate.dk
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="text-white font-semibold mb-6 uppercase tracking-widest text-xs">
              {t.footer.legal}
            </h5>
            <ul className="space-y-4">
              <li>
                <a className="text-slate-500 hover:text-blue-300 transition-colors block" href="#">
                  {t.footer.privacy}
                </a>
              </li>
              <li>
                <a className="text-slate-500 hover:text-blue-300 transition-colors block" href="#">
                  {t.footer.terms}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-8 mt-20 pt-10 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
          <p>&copy; 2026 CVR-MATE. {t.footer.rights}</p>
          <p className="text-slate-600">{t.footer.developedBy}</p>
        </div>
      </footer>
    </>
  );
}
