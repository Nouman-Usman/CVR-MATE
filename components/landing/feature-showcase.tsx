"use client";

import { useRef, useState } from "react";
import Image from "next/image";

export interface ShowcaseTab {
  title: string;
  subtitle: string;
  body: string;
  bullets: string[];
  badge?: string;
  icon: string;
  screenshot: string;
}

const TAB_GRADIENTS = [
  "from-violet-500 to-fuchsia-400",
  "from-emerald-500 to-teal-400",
  "from-orange-500 to-rose-400",
  "from-blue-500 to-cyan-400",
  "from-amber-500 to-yellow-400",
];

export function FeatureShowcase({ tabs }: { tabs: ShowcaseTab[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const active = tabs[activeIndex];

  function selectTab(index: number) {
    setActiveIndex(index);
    setImageLoaded(false);
    chipRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }

  return (
    <div className="feature-card grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-6 lg:gap-10">
      {/* Mobile chip row */}
      <div className="flex lg:hidden gap-2 overflow-x-auto snap-x snap-mandatory scroll-px-4 pb-2 -mx-4 px-4">
        {tabs.map((tab, i) => (
          <button
            key={tab.title}
            ref={(el) => {
              chipRefs.current[i] = el;
            }}
            onClick={() => selectTab(i)}
            className={`snap-center shrink-0 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
              i === activeIndex
                ? "bg-white/[0.1] text-white border border-white/[0.15]"
                : "bg-white/[0.03] text-slate-500 border border-white/[0.05]"
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.title}
          </button>
        ))}
      </div>

      {/* Desktop vertical tab list */}
      <div className="hidden lg:flex flex-col gap-2">
        {tabs.map((tab, i) => (
          <button
            key={tab.title}
            onClick={() => selectTab(i)}
            className={`text-left rounded-2xl border p-5 transition-all duration-300 ${
              i === activeIndex
                ? "bg-white/[0.06] border-white/[0.12]"
                : "bg-transparent border-transparent hover:bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br ${TAB_GRADIENTS[i % TAB_GRADIENTS.length]} flex items-center justify-center`}
              >
                <span className="material-symbols-outlined text-lg text-white">{tab.icon}</span>
              </div>
              <span className="font-[family-name:var(--font-manrope)] font-bold text-white">
                {tab.title}
              </span>
              {tab.badge && (
                <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">
                  {tab.badge}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 leading-snug">{tab.subtitle}</p>
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 sm:p-7">
        <h3 className="font-[family-name:var(--font-manrope)] text-xl font-bold text-white mb-2">
          {active.title}
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed mb-5">{active.body}</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-6">
          {active.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="material-symbols-outlined text-base text-emerald-400 mt-0.5">check_circle</span>
              {bullet}
            </li>
          ))}
        </ul>

        {/* Screenshot shell — fixed aspect ratio, never shifts layout */}
        <div className="relative w-full aspect-[16/10] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d1424]">
          {/* browser-chrome top bar */}
          <div className="absolute top-0 inset-x-0 h-8 bg-white/[0.03] border-b border-white/[0.06] flex items-center gap-1.5 px-3 z-10">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          {!imageLoaded && (
            <div className="absolute inset-0 top-8 bg-white/[0.03] animate-pulse" />
          )}
          <Image
            key={active.screenshot}
            src={active.screenshot}
            alt={active.title}
            fill
            priority={activeIndex === 0}
            sizes="(min-width: 1024px) 60vw, 100vw"
            className={`object-cover object-top pt-8 transition-opacity duration-300 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
          />
        </div>
      </div>
    </div>
  );
}
