"use client";

import { Check } from "lucide-react";
import { PLANS, type PlanId } from "@/lib/stripe/plans";
import { Button } from "@/components/ui/button";

/* Matches the marketing site's featured pricing card: a cyan frame and an
   emerald "recommended" tag with the system's live-ping dot — no rainbow. */
export function RecommendationBanner({
  planId,
  onContinue,
}: {
  planId: PlanId;
  onContinue: () => void;
}) {
  const plan = PLANS[planId];

  return (
    <div className="relative rounded-2xl border border-cyan-400/40 bg-cyan-400/[0.04] p-5 shadow-[0_0_45px_-12px_rgba(34,211,238,0.35)]">
      <span className="absolute right-5 top-0 flex -translate-y-1/2 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-[#0a0f1e] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
        </span>
        Recommended
      </span>

      <p className="font-[family-name:var(--font-manrope)] text-xl font-extrabold tracking-tight text-white">
        {plan.name}
      </p>
      <p className="font-mono text-sm text-slate-400">
        {plan.price} {plan.currency}/mo after trial
      </p>

      <ul className="mt-4 space-y-2">
        <li className="flex items-center gap-2 text-sm text-white/80">
          <Check className="size-3.5 shrink-0 text-cyan-400" />
          14-day free trial, no charge today
        </li>
        <li className="flex items-center gap-2 text-sm text-white/80">
          <Check className="size-3.5 shrink-0 text-cyan-400" />
          Personal onboarding with our team
        </li>
      </ul>

      <Button onClick={onContinue} variant="gradient" size="lg" className="mt-5 w-full rounded-xl">
        Start my free trial
      </Button>
    </div>
  );
}
