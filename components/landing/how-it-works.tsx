"use client";

import { useLanguage } from "@/lib/i18n/language-context";

/* ─── How It Works ────────────────────────────────────────────────
   A genuine ordered sequence, so the numbering is earned. The thing
   the generic four-tile version hides is the real shape of the
   product: steps 1–2 you do once, steps 3–4 recur on your schedule.

   So the rail splits into two phases and the recurring phase carries
   the same emerald "live" marker the hero uses on a new company.
   Each step shows the concrete artifact it produces — filter tags,
   a cadence, a dated result batch, an export — not an abstract icon.
─────────────────────────────────────────────────────────────────── */

type Phase = "setup" | "run";

const STEPS: { phase: Phase; icon: string }[] = [
  { phase: "setup", icon: "tune" },
  { phase: "setup", icon: "bookmark_added" },
  { phase: "run", icon: "inbox" },
  { phase: "run", icon: "bolt" },
];

export function HowItWorks() {
  const { t } = useLanguage();
  const steps = t.howItWorks.steps.map((s, i) => ({ ...s, ...STEPS[i] }));

  return (
    <div className="how-grid grid gap-12 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-20">
      {/* Left — the thesis */}
      <div className="lg:pt-2">
        <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-slate-400">
          <span className="h-px w-8 bg-cyan-400/60" />
          {t.nav.howItWorks}
        </p>
        <h2 className="mt-6 font-[family-name:var(--font-manrope)] text-[clamp(1.9rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.025em] text-white">
          {t.howItWorks.title}
        </h2>
        <p className="mt-5 max-w-[42ch] text-[15px] leading-[1.75] text-slate-400">
          {t.howItWorks.subtitle}
        </p>
      </div>

      {/* Right — the rail */}
      <ol className="relative">
        {steps.map((step, i) => {
          const isRun = step.phase === "run";
          const phaseOpens = i === 0 || steps[i - 1].phase !== step.phase;

          return (
            <li key={step.num} className="how-step relative grid grid-cols-[3.5rem_1fr] gap-x-5 sm:grid-cols-[4rem_1fr] sm:gap-x-7">
              {/* Rail column: index node, plus a connector filling the gap
                  down to the next node. Anchored to the node's bottom edge
                  (top-6 + node height) so it holds at any row height. */}
              <div className="relative flex justify-center">
                {i < steps.length - 1 && (
                  <span
                    className={`rail-seg absolute inset-x-0 mx-auto bottom-0 w-px top-[4.5rem] sm:top-[5rem] origin-top ${
                      steps[i + 1].phase === "run" ? "bg-emerald-400/30" : "bg-white/12"
                    }`}
                  />
                )}

                <span
                  className={`relative z-10 mt-6 flex size-12 shrink-0 items-center justify-center rounded-full border font-mono text-[13px] font-bold tabular-nums sm:size-14 ${
                    isRun
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                      : "border-white/15 bg-white/[0.04] text-slate-300"
                  }`}
                >
                  {step.num}
                </span>
              </div>

              {/* Content column */}
              <div className={`min-w-0 pt-6 ${i < steps.length - 1 ? "pb-10" : ""}`}>
                {/* Phase header — printed once, where the phase opens */}
                {phaseOpens && (
                  <p
                    className={`mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] ${
                      isRun ? "text-emerald-400" : "text-slate-500"
                    }`}
                  >
                    {isRun && (
                      <span className="relative flex size-1.5">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                      </span>
                    )}
                    {t.howItWorks.phases[step.phase]}
                    {isRun && (
                      <span className="text-emerald-400/50">· {t.howItWorks.cadence}</span>
                    )}
                  </p>
                )}

                <div className="flex items-center gap-2.5">
                  <span
                    className={`material-symbols-outlined text-[19px] ${
                      isRun ? "text-emerald-300" : "text-cyan-400"
                    }`}
                    aria-hidden
                  >
                    {step.icon}
                  </span>
                  <h3 className="font-[family-name:var(--font-manrope)] text-lg font-bold tracking-tight text-white sm:text-xl">
                    {step.title}
                  </h3>
                </div>

                <p className="mt-2 max-w-[54ch] text-[14px] leading-[1.7] text-slate-400">
                  {step.desc}
                </p>

                {/* The artifact this step produces */}
                <span className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
                  {step.artifact}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
