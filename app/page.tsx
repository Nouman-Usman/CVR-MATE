"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLanguage } from "@/lib/i18n/language-context";
import { useSession } from "@/lib/auth-client";
import { LogoFull } from "@/components/logo";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { COMING_SOON_FEATURES, CONTACT_EMAIL } from "@/lib/constants";
import { ComingSoonBadge } from "@/components/ui/coming-soon";

gsap.registerPlugin(ScrollTrigger);

const HeroScene = dynamic(() => import("@/components/landing/hero-scene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#0a0f1e]" />,
});

/* ─── Glass Card ────────────────────────────────────────────────── */

function GlassCard({ children, className = "", glow = false }: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={`relative group ${className}`}>
      {glow && (
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
      )}
      <div className="relative bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 sm:p-8 hover:bg-white/[0.06] transition-all duration-300">
        {children}
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */

export default function Home() {
  const { locale, t, toggleLocale } = useLanguage();
  const { data: session } = useSession();
  const isLoggedIn = !!session;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pricingInterval, setPricingInterval] = useState<"monthly" | "annual">("monthly");

  // Refs for GSAP
  const heroRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  // Scroll detection for navbar
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // GSAP Animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero text entrance
      if (heroTextRef.current) {
        gsap.from(heroTextRef.current.children, {
          y: 60,
          opacity: 0,
          duration: 1,
          stagger: 0.15,
          ease: "power3.out",
          delay: 0.3,
        });
      }

      // Features cards
      if (featuresRef.current) {
        gsap.from(featuresRef.current.querySelectorAll(".feature-card"), {
          scrollTrigger: {
            trigger: featuresRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
          y: 80,
          opacity: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: "power3.out",
        });
      }

      // Steps
      if (stepsRef.current) {
        gsap.from(stepsRef.current.querySelectorAll(".step-item"), {
          scrollTrigger: {
            trigger: stepsRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
          y: 50,
          opacity: 0,
          duration: 0.7,
          stagger: 0.2,
          ease: "power3.out",
        });

        gsap.from(stepsRef.current.querySelectorAll(".step-line"), {
          scrollTrigger: {
            trigger: stepsRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
          scaleX: 0,
          duration: 1.2,
          stagger: 0.3,
          ease: "power3.inOut",
          delay: 0.5,
        });
      }

      // Pricing
      if (pricingRef.current) {
        gsap.from(pricingRef.current.querySelectorAll(".pricing-card"), {
          scrollTrigger: {
            trigger: pricingRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
          y: 60,
          opacity: 0,
          scale: 0.95,
          duration: 0.8,
          stagger: 0.2,
          ease: "power3.out",
        });
      }

      // CTA
      if (ctaRef.current) {
        gsap.from(ctaRef.current, {
          scrollTrigger: {
            trigger: ctaRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
          y: 40,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
        });
      }
    });

    return () => ctx.revert();
  }, []);

  const navLinks = [
    { label: t.nav.home, href: "#hero" },
    { label: t.nav.howItWorks, href: "#how-it-works" },
    { label: t.nav.pricing, href: "#pricing" },
    { label: t.nav.aboutAiMate, href: "#features" },
  ];

  const features = [
    { icon: "monitoring", title: t.features.card1Title, desc: t.features.card1Desc, gradient: "from-blue-500 to-cyan-400" },
    { icon: "bolt", title: t.features.card2Title, desc: t.features.card2Desc, gradient: "from-violet-500 to-purple-400" },
    { icon: "auto_awesome", title: t.products.flow.name, desc: t.products.flow.features[0], gradient: "from-cyan-500 to-emerald-400" },
  ];

  const steps = [
    { num: "01", label: t.howItWorks.steps[0].title, desc: t.howItWorks.steps[0].desc, icon: "search" },
    { num: "02", label: t.howItWorks.steps[1].title, desc: t.howItWorks.steps[1].desc, icon: "filter_alt" },
    { num: "03", label: t.howItWorks.steps[2].title, desc: t.howItWorks.steps[2].desc, icon: "notifications_active" },
    { num: "04", label: t.howItWorks.steps[3].title, desc: t.howItWorks.steps[3].desc, icon: "download" },
  ];

  return (
    <div className="bg-[#0a0f1e] text-white min-h-screen overflow-x-hidden">

      {/* ─── NAVBAR ──────────────────────────────────────────── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a0f1e]/80 backdrop-blur-2xl border-b border-white/[0.06] shadow-2xl shadow-black/20"
          : "bg-transparent"
      }`}>
        <div className="flex justify-between items-center max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20">
          <LogoFull size="small" variant="dark" />

          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-semibold text-slate-400 hover:text-white transition-colors font-[family-name:var(--font-manrope)]"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleLocale}
              className="text-slate-400 hover:text-white hover:bg-white/[0.06] p-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">language</span>
              <span className="text-xs font-bold uppercase tracking-widest font-[family-name:var(--font-manrope)]">
                {locale === "da" ? "EN" : "DA"}
              </span>
            </button>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="hidden sm:flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all border border-white/10"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden sm:block font-semibold text-sm text-slate-400 hover:text-white px-4 transition-colors">
                  {t.nav.login}
                </Link>
                <Link
                  href="/signup"
                  className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-blue-500/25 transition-all"
                >
                  {t.nav.getStarted}
                </Link>
              </>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer"
            >
              <span className="material-symbols-outlined text-2xl">
                {mobileMenuOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0a0f1e]/95 backdrop-blur-2xl border-t border-white/[0.06] px-4 pb-6 pt-2 animate-slide-down">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  className="py-3 px-4 rounded-lg font-semibold text-sm text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all"
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-col gap-3">
              {isLoggedIn ? (
                <Link href="/dashboard" className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-bold text-sm text-center block">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className="w-full py-3 text-slate-400 font-semibold text-sm rounded-xl border border-white/10 text-center block hover:bg-white/[0.04]">
                    {t.nav.login}
                  </Link>
                  <Link href="/signup" className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-bold text-sm text-center block">
                    {t.nav.getStarted}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ─── HERO ────────────────────────────────────────────── */}
      <section id="hero" ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* 3D Scene */}
        <Suspense fallback={<div className="absolute inset-0 bg-[#0a0f1e]" />}>
          <HeroScene />
        </Suspense>

        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_#0a0f1e_70%)] z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0f1e] z-[1]" />

        {/* Content */}
        <div ref={heroTextRef} className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center pt-20">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/[0.06] backdrop-blur-sm rounded-full border border-white/[0.1] mb-8">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-300">
              {t.hero.badge}
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-[family-name:var(--font-manrope)] text-4xl sm:text-6xl lg:text-8xl font-extrabold leading-[1.05] tracking-tight mb-6">
            <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
              {t.hero.headline}
            </span>
          </h1>

          {/* Description */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
            {t.hero.description}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              href="/signup"
              className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-base sm:text-lg overflow-hidden transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 transition-all group-hover:scale-105" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-blue-500 to-cyan-400" />
              <span className="relative z-10 flex items-center gap-2">
                {t.hero.bookDemo}
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </span>
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-base sm:text-lg border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-sm transition-all text-slate-300 hover:text-white"
            >
              <span className="material-symbols-outlined text-lg">play_circle</span>
              {t.hero.explorePlatform}
            </Link>
          </div>

          {/* Pills */}
          <div className="flex flex-wrap justify-center gap-3">
            {t.hero.pills.map((pill: string) => (
              <span
                key={pill}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] rounded-full text-xs font-medium text-slate-400"
              >
                <span className="material-symbols-outlined text-xs text-cyan-400">check_circle</span>
                {pill}
              </span>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-xl text-slate-500">expand_more</span>
        </div>
      </section>

      {/* ─── FEATURES ────────────────────────────────────────── */}
      <section id="features" ref={featuresRef} className="relative py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Section header */}
          <div className="text-center mb-16 sm:mb-20">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full text-xs font-bold uppercase tracking-widest text-blue-400 mb-4 border border-blue-500/20">
              Features
            </span>
            <h2 className="font-[family-name:var(--font-manrope)] text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
              <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                {t.features.title}
              </span>
            </h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">{t.features.subtitle}</p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div key={i} className="feature-card">
                <GlassCard glow>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-5 shadow-lg`}>
                    <span className="material-symbols-outlined text-2xl text-white">{f.icon}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3 font-[family-name:var(--font-manrope)]">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </GlassCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────────── */}
      <section id="how-it-works" ref={stepsRef} className="relative py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16 sm:mb-20">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 rounded-full text-xs font-bold uppercase tracking-widest text-cyan-400 mb-4 border border-cyan-500/20">
              Process
            </span>
            <h2 className="font-[family-name:var(--font-manrope)] text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
              <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                {t.howItWorks.title}
              </span>
            </h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">{t.howItWorks.subtitle}</p>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Connecting lines (desktop only) */}
            <div className="hidden lg:block absolute top-16 left-[18%] right-[18%] h-[2px] z-0">
              <div className="step-line w-full h-full bg-gradient-to-r from-blue-500/40 via-cyan-500/40 to-blue-500/40 origin-left" />
            </div>

            {steps.map((step, i) => (
              <div key={i} className="step-item relative z-10 text-center">
                {/* Number circle */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/20">
                  <span className="material-symbols-outlined text-2xl text-white">{step.icon}</span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400 mb-2">{step.num}</div>
                <h3 className="text-base font-bold text-white mb-2 font-[family-name:var(--font-manrope)]">{step.label}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-[220px] mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─────────────────────────────────────────── */}
      <section id="pricing" ref={pricingRef} className="relative py-24 sm:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-violet-500/10 rounded-full text-xs font-bold uppercase tracking-widest text-violet-400 mb-4 border border-violet-500/20">
              {t.pricing.title}
            </span>
            <h2 className="font-[family-name:var(--font-manrope)] text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
              <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                {t.pricing.title}
              </span>
            </h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto mb-8">{t.pricing.subtitle}</p>

            {/* Monthly / Annual toggle */}
            <div className="flex justify-center">
              <div className="inline-flex bg-white/[0.06] rounded-full p-1 gap-1 border border-white/[0.08]">
                <button
                  onClick={() => setPricingInterval("monthly")}
                  className={`px-5 py-2 rounded-full text-sm font-bold transition-all cursor-pointer ${
                    pricingInterval === "monthly"
                      ? "bg-white/[0.1] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {t.pricing.monthly}
                </button>
                <button
                  onClick={() => setPricingInterval("annual")}
                  className={`px-5 py-2 rounded-full text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    pricingInterval === "annual"
                      ? "bg-white/[0.1] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {t.pricing.annual}
                  <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                    {t.pricing.annualSave}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            {/* Starter */}
            <div className="pricing-card">
              <GlassCard>
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-white mb-1 font-[family-name:var(--font-manrope)]">{t.pricing.starter.name}</h3>
                  <p className="text-sm text-slate-500">{t.pricing.starter.desc}</p>
                </div>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold text-white font-[family-name:var(--font-manrope)]">
                      {pricingInterval === "annual" ? t.pricing.starter.annualPrice : t.pricing.starter.price}
                    </span>
                    <span className="text-sm text-slate-500">DKK{t.pricing.period}</span>
                  </div>
                  {pricingInterval === "annual" && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-600 line-through">{t.pricing.starter.price} DKK</span>
                      <span className="text-[10px] text-emerald-400 font-bold">2,868 DKK/yr</span>
                    </div>
                  )}
                </div>
                <ul className="space-y-2.5 mb-8">
                  {t.pricing.starter.features.map((f: string) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-400">
                      <span className="material-symbols-outlined text-sm text-cyan-400 mt-0.5 shrink-0">check_circle</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="block w-full py-3 rounded-xl border border-white/[0.12] text-center font-bold text-sm text-slate-300 hover:bg-white/[0.06] transition-all"
                >
                  {t.pricing.starter.cta}
                </Link>
              </GlassCard>
            </div>

            {/* Professional — featured */}
            <div className="pricing-card relative">
              <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-blue-500 via-cyan-500 to-violet-500 opacity-60 blur-[1px]" />
              <div className="relative bg-[#0d1225] rounded-2xl p-6 sm:p-8 border border-white/[0.08]">
                <div className="absolute top-0 right-6 -translate-y-1/2">
                  <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                    Recommended
                  </span>
                </div>
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-white mb-1 font-[family-name:var(--font-manrope)]">{t.pricing.professional.name}</h3>
                  <p className="text-sm text-slate-500">{t.pricing.professional.desc}</p>
                </div>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent font-[family-name:var(--font-manrope)]">
                      {pricingInterval === "annual" ? t.pricing.professional.annualPrice : t.pricing.professional.price}
                    </span>
                    <span className="text-sm text-slate-500">DKK{t.pricing.period}</span>
                  </div>
                  {pricingInterval === "annual" && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-600 line-through">{t.pricing.professional.price} DKK</span>
                      <span className="text-[10px] text-emerald-400 font-bold">6,708 DKK/yr</span>
                    </div>
                  )}
                </div>
                <ul className="space-y-2.5 mb-8">
                  {t.pricing.professional.features.map((f: string) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <span className="material-symbols-outlined text-sm text-cyan-400 mt-0.5 shrink-0">check_circle</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="block w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-center font-bold text-sm text-white hover:shadow-lg hover:shadow-blue-500/25 transition-all"
                >
                  {t.pricing.professional.cta}
                </Link>
              </div>
            </div>

            {/* Enterprise */}
            <div className="pricing-card">
              <GlassCard>
                <div className="mb-5 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1 font-[family-name:var(--font-manrope)]">{t.pricing.enterprise.name}</h3>
                    <p className="text-sm text-slate-500">{t.pricing.enterprise.desc}</p>
                  </div>
                  {COMING_SOON_FEATURES.has("team") && (
                    <ComingSoonBadge />
                  )}
                </div>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold text-white font-[family-name:var(--font-manrope)]">
                      {pricingInterval === "annual" ? t.pricing.enterprise.annualPrice : t.pricing.enterprise.price}
                    </span>
                    <span className="text-sm text-slate-500">DKK{t.pricing.period}</span>
                  </div>
                  {pricingInterval === "annual" && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-600 line-through">{t.pricing.enterprise.price} DKK</span>
                      <span className="text-[10px] text-emerald-400 font-bold">16,308 DKK/yr</span>
                    </div>
                  )}
                </div>
                <ul className="space-y-2.5 mb-8">
                  {t.pricing.enterprise.features.map((f: string) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-400">
                      <span className="material-symbols-outlined text-sm text-cyan-400 mt-0.5 shrink-0">check_circle</span>
                      {f}
                    </li>
                  ))}
                </ul>
                {COMING_SOON_FEATURES.has("team") ? (
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("CVR-MATE Enterprise Inquiry")}`}
                    className="block w-full py-3 rounded-xl bg-amber-600 text-center font-bold text-sm text-white hover:bg-amber-700 transition-all"
                  >
                    Contact us
                  </a>
                ) : (
                  <Link
                    href="/signup"
                    className="block w-full py-3 rounded-xl border border-white/[0.12] text-center font-bold text-sm text-slate-300 hover:bg-white/[0.06] transition-all"
                  >
                    {t.pricing.enterprise.cta}
                  </Link>
                )}
              </GlassCard>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {t.trust.items.map((item: { icon: string; title: string; desc: string }, i: number) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl text-blue-400">{item.icon}</span>
                </div>
                <h4 className="text-sm font-bold text-white">{item.title}</h4>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────────── */}
      <section ref={ctaRef} className="py-24 sm:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="relative rounded-3xl overflow-hidden">
            {/* Gradient bg */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-violet-600/20" />
            <div className="absolute inset-0 bg-[#0a0f1e]/60 backdrop-blur-xl" />
            <div className="absolute inset-[1px] rounded-3xl border border-white/[0.06]" />

            <div className="relative py-16 sm:py-20 px-8 sm:px-16 text-center">
              <h2 className="font-[family-name:var(--font-manrope)] text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
                <span className="bg-gradient-to-r from-white via-blue-200 to-white bg-clip-text text-transparent">
                  {t.cta.title}
                </span>
              </h2>
              <p className="text-base sm:text-lg text-slate-400 max-w-lg mx-auto mb-8">
                {t.cta.subtitle}
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-lg hover:shadow-xl hover:shadow-blue-500/25 transition-all"
              >
                {t.cta.button1}
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12 mb-12">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <LogoFull size="small" variant="dark" className="mb-4" />
              <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
                {t.footer.tagline}
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">{t.footer.platform}</h4>
              <div className="flex flex-col gap-3">
                {t.footer.platformLinks.map((label: string) => (
                  <a key={label} href="#" className="text-sm text-slate-500 hover:text-white transition-colors">
                    {label}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">{t.footer.resources}</h4>
              <div className="flex flex-col gap-3">
                {t.footer.resourceLinks.map((label: string) => (
                  <a key={label} href="#" className="text-sm text-slate-500 hover:text-white transition-colors">
                    {label}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">{t.footer.contact}</h4>
              <div className="flex flex-col gap-3">
                <a href="#" className="text-sm text-slate-500 hover:text-white transition-colors">{t.footer.privacy}</a>
                <a href="#" className="text-sm text-slate-500 hover:text-white transition-colors">{t.footer.terms}</a>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">{t.footer.rights}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
