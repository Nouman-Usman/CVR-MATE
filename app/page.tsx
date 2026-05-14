"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
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

/* ─── Glass Dashboard Preview ─────────────────────────────────────── */

const GlassDashboard = () => {
  const { t } = useLanguage();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const companies = [
    { name: "TECHCORP A/S", industry: t.hero.appPreview.ind_saas, status: t.hero.appPreview.status_growth, score: 98, growth: 28 },
    { name: "NORDIC BI", industry: t.hero.appPreview.ind_data, status: t.hero.appPreview.status_new, score: 92, growth: 15 },
    { name: "DATAFLOW ApS", industry: t.hero.appPreview.ind_fintech, status: t.hero.appPreview.status_stable, score: 85, growth: 5 },
  ];

  return (
    <div className="w-full bg-[#0a0f1e]/80 backdrop-blur-2xl border border-white/[0.1] rounded-2xl p-6 shadow-2xl shadow-blue-900/20 text-left">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/[0.1] pb-4">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <div className="font-mono text-xs text-slate-300 font-bold uppercase flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          {t.hero.appPreview.liveFeed}
        </div>
      </div>
      
      {/* List */}
      <div className="flex flex-col gap-3 pt-4">
        {companies.map((c, i) => (
          <div 
            key={i} 
            className="flex flex-col sm:flex-row justify-between sm:items-center bg-white/[0.03] border border-white/[0.05] rounded-xl p-4 hover:bg-white/[0.06] transition-all hover:scale-[1.02] gap-3"
          >
            <div className="flex flex-col">
              <div className="font-semibold text-white text-sm sm:text-base">{c.name}</div>
              <div className="font-mono text-[10px] text-cyan-400 font-bold uppercase tracking-wider">{c.industry}</div>
            </div>
            
            <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
              <div className="flex items-center gap-3 w-28">
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${(c.growth / 30) * 100}%` }} />
                </div>
                <span className="font-mono text-xs font-bold text-emerald-400">+{c.growth}%</span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md uppercase ${
                  c.status === t.hero.appPreview.status_growth ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                  c.status === t.hero.appPreview.status_new ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-white/5 text-slate-300 border border-white/10'
                }`}>
                  {c.status}
                </span>
                <span className="font-mono font-bold text-lg w-8 text-right text-white">{c.score}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

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

/* ─── Interactive Feature Card ─────────────────────────────────────── */

function InteractiveFeatureCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useMotionValue(0), { damping: 30, stiffness: 200, mass: 2 });
  const rotateY = useSpring(useMotionValue(0), { damping: 30, stiffness: 200, mass: 2 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    
    mouseX.set(x);
    mouseY.set(y);
    
    const xPct = (x / width - 0.5) * 2;
    const yPct = (y / height - 0.5) * 2;
    
    rotateX.set(yPct * -10); // tilt up/down
    rotateY.set(xPct * 10); // tilt left/right
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      className={`relative group h-full ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
    >
      {/* Dynamic Spotlight Hover */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-500 group-hover:opacity-100 z-10"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              600px circle at ${mouseX}px ${mouseY}px,
              rgba(56, 189, 248, 0.15),
              transparent 80%
            )
          `,
        }}
      />
      {/* Outer static glow */}
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-md z-0" />
      
      {/* Actual Card */}
      <div 
        className="relative h-full bg-[#0a0f1e]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 z-10 transition-colors duration-500 group-hover:border-white/[0.15]"
        style={{ transform: "translateZ(30px)" }}
      >
        {children}
      </div>
    </motion.div>
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
        gsap.fromTo(featuresRef.current.querySelectorAll(".feature-card"), 
          { y: 100, opacity: 0, scale: 0.9, filter: "blur(10px)" },
          {
            scrollTrigger: {
              trigger: featuresRef.current,
              start: "top 80%",
              toggleActions: "play none none reverse",
            },
            y: 0,
            opacity: 1,
            scale: 1,
            filter: "blur(0px)",
            duration: 1.2,
            stagger: 0.15,
            ease: "power4.out",
          }
        );
      }

      // Steps
      if (stepsRef.current) {
        // Line reveal
        gsap.fromTo(stepsRef.current.querySelectorAll(".step-line"), 
          { clipPath: "inset(0 100% 0 0)" },
          {
            scrollTrigger: {
              trigger: stepsRef.current,
              start: "top 70%",
              toggleActions: "play none none reverse",
            },
            clipPath: "inset(0 0% 0 0)",
            duration: 1.8,
            ease: "power3.inOut",
          }
        );

        // Step items
        gsap.fromTo(stepsRef.current.querySelectorAll(".step-item"), 
          { y: 60, opacity: 0, scale: 0.85, filter: "blur(8px)" },
          {
            scrollTrigger: {
              trigger: stepsRef.current,
              start: "top 70%",
              toggleActions: "play none none reverse",
            },
            y: 0,
            opacity: 1,
            scale: 1,
            filter: "blur(0px)",
            duration: 1,
            stagger: 0.25,
            ease: "back.out(1.2)", // Remotion "playful overshoot" feel
          }
        );
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
    { icon: "auto_awesome", title: t.features.card1Title, desc: t.features.card1Desc, gradient: "from-violet-500 to-fuchsia-400", comingSoon: false },
    { icon: "trending_up", title: t.features.card2Title, desc: t.features.card2Desc, gradient: "from-emerald-500 to-teal-400", comingSoon: false },
    { icon: "radar", title: t.features.card3Title, desc: t.features.card3Desc, gradient: "from-orange-500 to-rose-400", comingSoon: false },
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
              aria-label={locale === "da" ? "Skift til engelsk" : "Switch to Danish"}
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
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
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
                {t.nav.getStarted}
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
          <div className="flex flex-wrap justify-center gap-3 mb-16">
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

          {/* Visualization Area */}
          <div className="relative mt-8 flex items-center justify-center w-full max-w-4xl mx-auto">
            <div className="w-full max-w-2xl z-20">
              <GlassDashboard />
            </div>

            {/* Floating Elements */}
            <div className="absolute -top-12 -right-4 lg:-right-12 hidden md:block z-30 animate-pulse" style={{ animationDuration: '4s' }}>
              <GlassCard className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                  <span className="material-symbols-outlined text-xl text-emerald-400">trending_up</span>
                </div>
                <div className="text-left">
                  <div className="text-xs text-slate-400 font-medium">{t.hero.appPreview.growthSignal}</div>
                  <div className="text-lg font-bold text-white">+12.4%</div>
                </div>
              </GlassCard>
            </div>

            <div className="absolute -bottom-8 -left-4 lg:-left-12 hidden md:block z-30 animate-pulse" style={{ animationDuration: '5s', animationDelay: '0.5s' }}>
              <GlassCard className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                  <span className="material-symbols-outlined text-xl text-cyan-400">database</span>
                </div>
                <div className="text-left">
                  <div className="text-xs text-slate-400 font-medium">{t.hero.appPreview.liveFeed}</div>
                  <div className="text-lg font-bold text-white">{t.hero.appPreview.speed}</div>
                </div>
              </GlassCard>
            </div>
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
                <InteractiveFeatureCard>
                  <div className="flex items-start justify-between mb-5">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center shadow-lg`}>
                      <span className="material-symbols-outlined text-2xl text-white">{f.icon}</span>
                    </div>
                    {f.comingSoon && <ComingSoonBadge />}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3 font-[family-name:var(--font-manrope)]">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </InteractiveFeatureCard>
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
              <div className="step-line w-full h-full bg-gradient-to-r from-blue-500/40 via-cyan-500/40 to-blue-500/40" />
            </div>

            {steps.map((step, i) => (
              <motion.div 
                key={i} 
                className="step-item relative z-10 text-center group"
                whileHover={{ y: -8 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {/* Number circle */}
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md flex items-center justify-center mx-auto mb-5 shadow-lg group-hover:bg-gradient-to-br group-hover:from-blue-600 group-hover:to-cyan-500 group-hover:border-transparent transition-all duration-500">
                  <span className="material-symbols-outlined text-2xl text-white opacity-70 group-hover:opacity-100 transition-opacity">{step.icon}</span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400 mb-2 opacity-80 group-hover:opacity-100 transition-opacity">{step.num}</div>
                <h3 className="text-base font-bold text-white mb-2 font-[family-name:var(--font-manrope)]">{step.label}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-[220px] mx-auto group-hover:text-slate-400 transition-colors">{step.desc}</p>
              </motion.div>
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
              <p className="text-sm text-slate-500 leading-relaxed max-w-xs mb-6">
                {t.footer.tagline}
              </p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">mail</span>
                {CONTACT_EMAIL}
              </a>
            </div>

            {/* Platform */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">{t.footer.platform}</h4>
              <div className="flex flex-col gap-3">
                <a href="#features" className="text-sm text-slate-500 hover:text-white transition-colors">
                  {locale === "da" ? "Funktioner" : "Features"}
                </a>
                <a href="#how-it-works" className="text-sm text-slate-500 hover:text-white transition-colors">
                  {locale === "da" ? "Sådan fungerer det" : "How it works"}
                </a>
                <a href="#pricing" className="text-sm text-slate-500 hover:text-white transition-colors">
                  {locale === "da" ? "Priser" : "Pricing"}
                </a>
                <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("CVR-MATE CRM Integration")}`} className="text-sm text-slate-500 hover:text-white transition-colors inline-flex items-center gap-1.5">
                  {locale === "da" ? "Integrationer" : "Integrations"}
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 border border-amber-400/30 rounded-full px-1.5 py-0.5">
                    {locale === "da" ? "Snart" : "Soon"}
                  </span>
                </a>
              </div>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">{t.footer.legal}</h4>
              <div className="flex flex-col gap-3">
                <Link href="/privacy" className="text-sm text-slate-500 hover:text-white transition-colors">{t.footer.privacy}</Link>
                <Link href="/terms" className="text-sm text-slate-500 hover:text-white transition-colors">{t.footer.terms}</Link>
                <Link href="/data-security" className="text-sm text-slate-500 hover:text-white transition-colors">{t.footer.dataSecurity}</Link>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">{t.footer.contact}</h4>
              <div className="flex flex-col gap-3">
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm text-slate-500 hover:text-white transition-colors">{t.footer.getInTouch}</a>
                <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("CVR-MATE Enterprise Inquiry")}`} className="text-sm text-slate-500 hover:text-white transition-colors">
                  {locale === "da" ? "Enterprise-forespørgsel" : "Enterprise inquiry"}
                </a>
                <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("CVR-MATE Partnership")}`} className="text-sm text-slate-500 hover:text-white transition-colors">
                  {locale === "da" ? "Partnerskaber" : "Partnerships"}
                </a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">{t.footer.rights}</p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">{t.footer.privacy}</Link>
              <Link href="/terms" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">{t.footer.terms}</Link>
              <Link href="/data-security" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">{t.footer.dataSecurity}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
