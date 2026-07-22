"use client";

import { Check } from "lucide-react";
import { PLANS, type PlanId } from "@/lib/stripe/plans";
import { Button } from "@/components/ui/button";

export function RecommendationBanner({
  planId,
  onContinue,
}: {
  planId: PlanId;
  onContinue: () => void;
}) {
  const plan = PLANS[planId];

  return (
    <div className="relative group">
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/40 via-cyan-500/40 to-blue-500/40 blur-sm" />
      <div className="relative rounded-2xl border border-white/10 bg-[#0a0f1e]/95 backdrop-blur-xl p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-cyan-400/70">
          Recommended for you
        </p>
        <p className="mt-1.5 text-xl font-black tracking-tight font-[family-name:var(--font-manrope)] text-white">
          {plan.name}
        </p>
        <p className="text-sm font-mono text-slate-400">
          {plan.price} {plan.currency}/mo after trial
        </p>
        <ul className="mt-3 space-y-1.5">
          <li className="flex items-center gap-2 text-sm text-white/80">
            <Check className="size-3.5 text-cyan-400 shrink-0" />
            14-day free trial, no charge today
          </li>
          <li className="flex items-center gap-2 text-sm text-white/80">
            <Check className="size-3.5 text-cyan-400 shrink-0" />
            Personal onboarding with our team
          </li>
        </ul>
        <Button onClick={onContinue} variant="gradient" size="lg" className="mt-4 w-full rounded-xl">
          Start my free trial
        </Button>
      </div>
    </div>
  );
}
