"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/language-context";
import { useSession } from "@/lib/auth-client";
import { LogoFull } from "@/components/logo";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HeroKartotek } from "@/components/landing/hero-kartotek";
import { HeroChatLauncher } from "@/components/landing/hero-chat-launcher";
import { FeatureDrawer } from "@/components/landing/feature-drawer";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PricingCards } from "@/components/landing/pricing-cards";
import { CONTACT_EMAIL } from "@/lib/constants";

gsap.registerPlugin(ScrollTrigger);


/* ─── Main Page ─────────────────────────────────────────────────── */

export default function Home() {
  const { locale, t, toggleLocale } = useLanguage();
  const { data: session } = useSession();
  const isLoggedIn = !!session;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

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

  // Scroll-spy: highlight the nav link matching the section in view
  const [activeSection, setActiveSection] = useState("hero");
  useEffect(() => {
    const sections = [heroRef, featuresRef, stepsRef, pricingRef]
      .map((ref) => ref.current)
      .filter((el): el is HTMLDivElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
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

      // Features drawer — each divider rule wipes open, then its rows
      // rise behind it. One orchestrated reveal per section.
      if (featuresRef.current) {
        featuresRef.current.querySelectorAll(".drawer-section").forEach((section) => {
          const trigger = { trigger: section, start: "top 85%", toggleActions: "play none none reverse" };

          gsap.fromTo(
            section.querySelector(".drawer-rule"),
            { clipPath: "inset(0 100% 0 0)" },
            { ...{ scrollTrigger: trigger }, clipPath: "inset(0 0% 0 0)", duration: 0.9, ease: "power3.inOut" }
          );

          gsap.fromTo(
            section.querySelectorAll(".drawer-row"),
            { y: 24, opacity: 0 },
            {
              scrollTrigger: trigger,
              y: 0,
              opacity: 1,
              duration: 0.7,
              stagger: 0.09,
              delay: 0.15,
              ease: "power3.out",
            }
          );
        });
      }

      // How it works — the rail draws down and the steps rise in behind it,
      // in order, so the reveal reads as the sequence executing top to bottom.
      if (stepsRef.current) {
        const trigger = {
          trigger: stepsRef.current,
          start: "top 72%",
          toggleActions: "play none none reverse",
        };

        gsap.fromTo(
          stepsRef.current.querySelectorAll(".rail-seg"),
          { scaleY: 0 },
          {
            scrollTrigger: trigger,
            scaleY: 1,
            duration: 0.7,
            stagger: 0.18,
            ease: "power2.inOut",
          }
        );

        gsap.fromTo(
          stepsRef.current.querySelectorAll(".how-step"),
          { y: 34, opacity: 0, filter: "blur(6px)" },
          {
            scrollTrigger: trigger,
            y: 0,
            opacity: 1,
            filter: "blur(0px)",
            duration: 0.7,
            stagger: 0.18,
            ease: "power3.out",
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


  return (
    <div className="bg-[#0a0f1e] text-white min-h-screen overflow-x-hidden">

      {/* ─── NAVBAR ──────────────────────────────────────────── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a0f1e]/80 backdrop-blur-2xl border-b border-white/[0.06] shadow-2xl shadow-black/20"
          : "bg-transparent"
      }`}>
        <div className="flex justify-between items-center max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20">
          <Link href="/" aria-label="CVR-MATE home">
            <LogoFull size="small" variant="dark" />
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => {
              const isActive = link.href === `#${activeSection}`;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  className={`relative text-sm font-semibold transition-colors font-[family-name:var(--font-manrope)] pb-1 ${
                    isActive ? "text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute -bottom-0.5 left-0 h-[2px] w-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-opacity duration-300 ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </a>
              );
            })}
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
                className="hidden lg:flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all border border-white/10"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden lg:block font-semibold text-sm text-slate-400 hover:text-white px-4 transition-colors">
                  {t.nav.login}
                </Link>
                <Link
                  href="/signup"
                  className="hidden lg:flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-blue-500/25 transition-all"
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
              {navLinks.map((link) => {
                const isActive = link.href === `#${activeSection}`;
                return (
                  <a
                    key={link.label}
                    className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
                      isActive
                        ? "text-white bg-white/[0.06]"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                );
              })}
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
      <section
        id="hero"
        ref={heroRef}
        className="relative min-h-screen flex items-center bg-[#0a0f1e] overflow-hidden"
      >
        {/* Site-standard atmosphere */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(at 0% 0%, rgba(37,99,235,0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(34,211,238,0.08) 0px, transparent 50%)",
          }}
        />
        {/* Desk grain — the surface the cards lie on */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(103deg, rgba(255,255,255,0.014) 0 2px, transparent 2px 5px)",
          }}
        />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-6 py-28 grid lg:grid-cols-2 gap-16 lg:gap-12 items-center">
          <div ref={heroTextRef}>
            <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-slate-400">
              <span className="h-px w-8 bg-cyan-400/60" />
              {t.hero.eyebrow}
            </p>

            <h1 className="mt-7 font-[family-name:var(--font-manrope)] text-[clamp(2.3rem,5vw,4.1rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.025em] text-white">
              {(() => {
                const [lead, ...rest] = t.hero.headline.split("—");
                return (
                  <>
                    {lead.trim()}
                    {rest.length > 0 && (
                      <span className="block text-slate-500">
                        {rest.join("—").trim()}
                      </span>
                    )}
                  </>
                );
              })()}
            </h1>

            <p className="mt-7 max-w-[42ch] text-[15px] leading-[1.75] text-slate-400">
              {t.hero.description}
            </p>

            {/* Primary action: start the conversation, seeded into the funnel */}
            <div className="mt-9">
              <HeroChatLauncher />
            </div>

            <div className="mt-6">
              <Link
                href="#how-it-works"
                className="text-sm font-medium text-slate-400 underline decoration-white/20 underline-offset-[6px] transition-colors hover:text-white hover:decoration-cyan-400"
              >
                {t.hero.explorePlatform}
              </Link>
            </div>
          </div>

          {/* The drawer */}
          <HeroKartotek />
        </div>
      </section>

      {/* ─── FEATURES ────────────────────────────────────────── */}
      <section id="features" ref={featuresRef} className="relative py-24 sm:py-32">
        <div className="max-w-5xl mx-auto px-5 sm:px-6">
          {/* Section header */}
          <div className="mb-16 sm:mb-20 max-w-2xl">
            <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-slate-400">
              <span className="h-px w-8 bg-cyan-400/60" />
              {t.nav.aboutAiMate}
            </p>
            <h2 className="mt-6 font-[family-name:var(--font-manrope)] text-[clamp(1.9rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.025em] text-white">
              {t.features.title}
            </h2>
            <p className="mt-5 max-w-[52ch] text-[15px] leading-[1.75] text-slate-400">
              {t.features.subtitle}
            </p>
          </div>

          <FeatureDrawer />
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────────── */}
      <section id="how-it-works" ref={stepsRef} className="relative py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <HowItWorks />
        </div>
      </section>

      {/* ─── PRICING ─────────────────────────────────────────── */}
      <section id="pricing" ref={pricingRef} className="relative py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-slate-400">
              <span className="h-px w-8 bg-cyan-400/60" />
              {t.nav.pricing}
            </p>
            <h2 className="mt-6 font-[family-name:var(--font-manrope)] text-[clamp(1.9rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.025em] text-white">
              {t.pricing.title}
            </h2>
            <p className="mt-5 max-w-[52ch] text-[15px] leading-[1.75] text-slate-400">
              {t.pricing.subtitle}
            </p>
          </div>

          <PricingCards />
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────── */}
      <section className="relative py-24 sm:py-32">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <div className="mb-12">
            <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-slate-400">
              <span className="h-px w-8 bg-cyan-400/60" />
              FAQ
            </p>
            <h2 className="mt-6 font-[family-name:var(--font-manrope)] text-[clamp(1.9rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.025em] text-white">
              {t.pricing.faq.title}
            </h2>
          </div>

          {/* Register-style Q/A rows — the mono Q/A stamps label rather than
              number, since the questions are not an ordered sequence. */}
          <div className="border-t border-white/12">
            {t.pricing.faq.items.map((item: { q: string; a: string }, i: number) => {
              const isOpen = openFaqIndex === i;
              return (
                <div key={item.q} className="border-b border-white/12">
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    className="group flex w-full items-center gap-4 py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                  >
                    <span className="mt-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-400">
                      Q
                    </span>
                    <span className="flex-1 font-[family-name:var(--font-manrope)] text-[15px] font-bold text-white sm:text-base">
                      {item.q}
                    </span>
                    <span
                      className={`material-symbols-outlined shrink-0 text-slate-500 transition-transform duration-300 group-hover:text-slate-300 ${isOpen ? "rotate-45" : ""}`}
                    >
                      add
                    </span>
                  </button>
                  <motion.div
                    id={`faq-a-${i}`}
                    initial={false}
                    animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="flex gap-4 pb-6 text-sm leading-relaxed text-slate-400">
                      <span className="mt-0.5 shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">
                        A
                      </span>
                      <span className="max-w-[60ch]">{item.a}</span>
                    </p>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── TRUST ───────────────────────────────────────────── */}
      {/* A register colophon: the data\'s provenance, cited the way an
          official extract stamps its source — authority, not chips. */}
      <section className="border-t border-white/[0.04] py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-5 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            {/* Source header — the official citation line */}
            <div className="flex flex-col gap-2 border-b border-white/10 bg-white/[0.02] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="flex items-center gap-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                </span>
                {t.trust.heading}
              </p>
              <p className="font-mono text-[11px] tracking-[0.06em] text-slate-500">
                {t.trust.source}
              </p>
            </div>

            {/* Credentials — three spec columns split by hairlines */}
            <div className="grid gap-px bg-white/10 sm:grid-cols-3">
              {t.trust.items.map((item: { icon: string; title: string; desc: string }) => (
                <div key={item.title} className="flex flex-col gap-3 bg-[#0a0f1e] p-6">
                  <span className="flex size-9 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-400">
                    <span className="material-symbols-outlined text-[19px]">{item.icon}</span>
                  </span>
                  <div>
                    <h4 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                      {item.title}
                    </h4>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────────── */}
      {/* The closing card. The page opens on a stack of register cards, so
          it ends on one final paper card — same stock, same stamp, angled
          the same way — bookending the whole page. Your card to fill. */}
      <section ref={ctaRef} className="py-24 sm:py-32">
        <div className="mx-auto max-w-xl px-5 sm:px-6">
          <div
            style={{
              background: "linear-gradient(#F5F8FC, #E4EAF5)",
              borderRadius: "3px",
              boxShadow: [
                "inset 0 1px 0 rgba(255,255,255,0.85)",
                "inset 0 -1px 0 rgba(11,18,32,0.16)",
                "0 1px 2px rgba(0,0,0,0.4)",
                "0 28px 60px -20px rgba(0,0,0,0.85)",
              ].join(", "),
              transform: "rotate(-1.2deg)",
            }}
            className="relative px-7 pb-12 pt-6 sm:px-10 sm:pb-14 sm:pt-7"
          >
            {/* Card header — provenance line + ready stamp, echoing the hero */}
            <div
              className="flex items-center justify-between gap-4 border-b pb-4"
              style={{ borderColor: "#0B122020" }}
            >
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "#0B122073" }}>
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                {t.cta.eyebrow}
              </span>
              <span
                className="-rotate-[7deg] border-[3px] px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] opacity-80"
                style={{ borderColor: "#0E7A57", color: "#0E7A57", mixBlendMode: "multiply" }}
              >
                {t.cta.stamp}
              </span>
            </div>

            <h2
              className="mt-6 font-[family-name:var(--font-manrope)] text-[clamp(1.9rem,4.6vw,2.9rem)] font-extrabold leading-[1.02] tracking-[-0.03em]"
              style={{ color: "#0B1220" }}
            >
              {t.cta.title}
            </h2>
            <p className="mt-4 max-w-[42ch] text-[15px] leading-[1.7]" style={{ color: "#3A4356" }}>
              {t.cta.subtitle}
            </p>

            <Link
              href="/signup"
              className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-7 py-3.5 text-base font-bold text-white transition-shadow hover:shadow-xl hover:shadow-blue-500/30"
            >
              {t.cta.button1}
              <span className="material-symbols-outlined transition-transform group-hover:translate-x-0.5">
                arrow_forward
              </span>
            </Link>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "#0B122066" }}>
              {t.cta.note}
            </p>

            {/* Punch hole — the card lived on a rod, like the hero\'s */}
            <span
              className="absolute bottom-4 left-1/2 size-3 -translate-x-1/2 rounded-full border"
              style={{ borderColor: "#0B122033", background: "#0B122012" }}
            />
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
