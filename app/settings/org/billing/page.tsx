"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSubscription,
  useCustomerPortal,
  useCancelSubscription,
  useResumeSubscription,
  useChangePlan,
} from "@/lib/hooks/use-subscription";
import { PLANS, type PlanId, PLAN_LIMITS } from "@/lib/stripe/plans";
import { cn } from "@/lib/utils";
import {
  CreditCard,
  Users,
  Zap,
  Search,
  Brain,
  Download,
  Shield,
  Crown,
  ArrowUpRight,
  Check,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Infinity as InfinityIcon,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface UsageData {
  plan: PlanId;
  status: string;
  usage: {
    aiUsages: { used: number; limit: number };
    companySearches: { used: number; limit: number };
    exports: { used: number; limit: number };
  };
  seats: { current: number; max: number };
  memberBreakdown: Array<{
    userId: string;
    feature: string;
    count: number;
    name: string;
    email: string;
    role: string;
  }>;
}

// ─── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  icon: Icon,
  used,
  limit,
  color,
}: {
  label: string;
  icon: typeof Search;
  used: number;
  limit: number;
  color: "blue" | "violet" | "emerald";
}) {
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 0 : limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isHigh = pct >= 80;

  const colorMap = {
    blue: {
      bg: "from-blue-500/10 to-cyan-500/10",
      icon: "text-blue-500",
      bar: "from-blue-500 to-cyan-400",
      ring: "ring-blue-500/20",
    },
    violet: {
      bg: "from-violet-500/10 to-purple-500/10",
      icon: "text-violet-500",
      bar: "from-violet-500 to-purple-400",
      ring: "ring-violet-500/20",
    },
    emerald: {
      bg: "from-emerald-500/10 to-teal-500/10",
      icon: "text-emerald-500",
      bar: "from-emerald-500 to-teal-400",
      ring: "ring-emerald-500/20",
    },
  };
  const c = colorMap[color];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center justify-center size-9 rounded-lg bg-gradient-to-br", c.bg)}>
          <Icon className={cn("size-4", c.icon)} />
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums tracking-tight">{used.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground font-medium">
            {isUnlimited ? "of unlimited" : `of ${limit.toLocaleString()}`}
          </p>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</p>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 bg-gradient-to-r",
              isHigh ? "from-amber-500 to-red-500" : c.bar
            )}
            style={{ width: isUnlimited ? "100%" : `${Math.max(pct, 2)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Plan card ──────────────────────────────────────────────────────────────

const planMeta: Record<PlanId, { icon: typeof Zap; accent: string; gradient: string; badge: string }> = {
  free: {
    icon: Zap,
    accent: "text-slate-500",
    gradient: "from-slate-100 to-slate-50",
    badge: "bg-slate-100 text-slate-600",
  },
  go: {
    icon: TrendingUp,
    accent: "text-blue-500",
    gradient: "from-blue-50 to-cyan-50",
    badge: "bg-blue-100 text-blue-700",
  },
  flow: {
    icon: Crown,
    accent: "text-violet-500",
    gradient: "from-violet-50 to-purple-50",
    badge: "bg-violet-100 text-violet-700",
  },
  enterprise: {
    icon: Shield,
    accent: "text-amber-500",
    gradient: "from-amber-50 to-orange-50",
    badge: "bg-amber-100 text-amber-700",
  },
};

function PlanCard({
  planId,
  currentPlan,
  onSelect,
  isChanging,
}: {
  planId: PlanId;
  currentPlan: PlanId;
  onSelect: (plan: PlanId) => void;
  isChanging: boolean;
}) {
  const plan = PLANS[planId];
  const limits = PLAN_LIMITS[planId];
  const meta = planMeta[planId];
  const isCurrent = planId === currentPlan;
  const isEnterprise = planId === "enterprise";
  const isPopular = planId === "flow";
  const Icon = meta.icon;

  const highlights = [
    { text: `${limits.maxSeats === Infinity ? "Unlimited" : limits.maxSeats} team seats`, ok: true },
    { text: `${limits.companySearchesPerMonth === Infinity ? "Unlimited" : limits.companySearchesPerMonth.toLocaleString()} searches/mo`, ok: true },
    { text: "AI-powered insights", ok: limits.aiFeatures },
    { text: "CRM integrations", ok: limits.crm },
    { text: "Team collaboration", ok: limits.teamFeatures },
    { text: "SSO & advanced security", ok: limits.sso },
    { text: "API access", ok: limits.apiAccess },
    { text: "Priority support", ok: limits.prioritySupport },
  ];

  return (
    <Card className={cn(
      "relative flex flex-col overflow-hidden transition-shadow hover:shadow-md",
      isCurrent && "ring-2 ring-primary/30 border-primary/40",
      isPopular && !isCurrent && "ring-1 ring-violet-200 border-violet-200"
    )}>
      {/* Top accent bar */}
      <div className={cn("h-1 w-full bg-gradient-to-r", meta.gradient)} />

      {isPopular && !isCurrent && (
        <div className="absolute top-3 right-3">
          <Badge className="bg-violet-100 text-violet-700 border-0 text-[10px] font-bold uppercase tracking-wide px-2">
            Popular
          </Badge>
        </div>
      )}
      {isCurrent && (
        <div className="absolute top-3 right-3">
          <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-bold uppercase tracking-wide px-2">
            Current
          </Badge>
        </div>
      )}

      <CardHeader className="pb-2 pt-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className={cn("size-9 rounded-lg bg-gradient-to-br flex items-center justify-center", meta.gradient)}>
            <Icon className={cn("size-4", meta.accent)} />
          </div>
          <CardTitle className="text-base font-bold">{plan.name}</CardTitle>
        </div>
        {isEnterprise ? (
          <div>
            <p className="text-2xl font-extrabold tracking-tight">Custom</p>
            <p className="text-xs text-muted-foreground mt-0.5">Tailored to your needs</p>
          </div>
        ) : plan.price === 0 ? (
          <div>
            <p className="text-2xl font-extrabold tracking-tight">Free</p>
            <p className="text-xs text-muted-foreground mt-0.5">No credit card required</p>
          </div>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold tracking-tight tabular-nums">
              {plan.price.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground font-medium">
              {plan.currency}
            </span>
            <span className="text-xs text-muted-foreground">/mo</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col pt-2">
        <Separator className="mb-4" />
        <ul className="space-y-2.5 flex-1">
          {highlights.map((h) => (
            <li key={h.text} className="flex items-start gap-2.5">
              {h.ok ? (
                <Check className="size-3.5 mt-0.5 shrink-0 text-emerald-500" />
              ) : (
                <X className="size-3.5 mt-0.5 shrink-0 text-muted-foreground/30" />
              )}
              <span className={cn(
                "text-[13px] leading-tight",
                h.ok ? "text-foreground" : "text-muted-foreground/40"
              )}>
                {h.text}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5">
          {isEnterprise ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open("mailto:sales@cvr-mate.dk?subject=Enterprise%20Plan", "_blank")}
            >
              Contact Sales
              <ArrowUpRight className="size-3.5 ml-1.5" />
            </Button>
          ) : isCurrent ? (
            <Button variant="outline" className="w-full" disabled>
              Current Plan
            </Button>
          ) : (
            <Button
              variant={isPopular ? "gradient" : "default"}
              className="w-full"
              onClick={() => onSelect(planId)}
              disabled={isChanging}
            >
              {isChanging ? "Processing..." : currentPlan === "free" ? "Get Started" : "Switch Plan"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { data: sub, isLoading: subLoading } = useSubscription();
  const portal = useCustomerPortal();
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();
  const changePlan = useChangePlan();

  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/usage");
      if (res.ok) setUsageData(await res.json());
    } catch {}
    finally { setUsageLoading(false); }
  }, []);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const currentPlan = (usageData?.plan ?? sub?.plan ?? "free") as PlanId;
  const isLoading = subLoading || usageLoading;

  async function handlePlanChange(target: PlanId) {
    if (target === "enterprise") return;
    try {
      await changePlan.mutateAsync(target as "free" | "go" | "flow");
      toast.success(`Switched to ${PLANS[target].name}`);
      fetchUsage();
    } catch (err: any) {
      toast.error(err.message || "Failed to change plan");
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Overview ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Billing & Usage</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor workspace usage and manage your subscription.
            </p>
          </div>
          {sub?.plan !== "free" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => portal.mutate()}
              disabled={portal.isPending}
            >
              <CreditCard className="size-4" data-icon="inline-start" />
              {portal.isPending ? "Opening..." : "Billing Portal"}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Plan status strip */}
            <div className="rounded-xl border bg-card p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "size-10 rounded-lg bg-gradient-to-br flex items-center justify-center",
                  planMeta[currentPlan].gradient
                )}>
                  <Sparkles className={cn("size-4", planMeta[currentPlan].accent)} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm">{PLANS[currentPlan]?.name ?? "Free"}</p>
                    {sub?.status === "active" && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px] h-5 font-semibold">
                        Active
                      </Badge>
                    )}
                    {sub?.status === "past_due" && (
                      <Badge className="bg-amber-500/10 text-amber-600 border-0 text-[10px] h-5 font-semibold">
                        <AlertTriangle className="size-3 mr-0.5" />
                        Past Due
                      </Badge>
                    )}
                    {sub?.cancelAtPeriodEnd && (
                      <Badge className="bg-red-500/10 text-red-600 border-0 text-[10px] h-5 font-semibold">
                        Cancels at period end
                      </Badge>
                    )}
                  </div>
                  {sub?.currentPeriodEnd && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {sub.cancelAtPeriodEnd ? "Access until" : "Renews"}{" "}
                      {new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {sub?.plan !== "free" && sub?.cancelAtPeriodEnd && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resume.mutate()}
                    disabled={resume.isPending}
                  >
                    {resume.isPending ? "Resuming..." : "Resume"}
                  </Button>
                )}
                {sub?.plan !== "free" && !sub?.cancelAtPeriodEnd && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground text-xs"
                    onClick={() => {
                      if (confirm("Cancel subscription? You keep access until the billing period ends.")) {
                        cancel.mutate();
                      }
                    }}
                    disabled={cancel.isPending}
                  >
                    {cancel.isPending ? "Cancelling..." : "Cancel"}
                  </Button>
                )}
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Seats */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-slate-500/10 to-slate-400/10">
                    <Users className="size-4 text-slate-500" />
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums tracking-tight">
                      {usageData?.seats?.current ?? 1}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      {usageData?.seats?.max === -1 ? "of unlimited" : `of ${usageData?.seats?.max ?? 1}`}
                    </p>
                  </div>
                </div>
                <p className="text-xs font-semibold text-muted-foreground">Team Seats</p>
              </div>

              <StatCard
                label="Company Searches"
                icon={Search}
                used={usageData?.usage?.companySearches?.used ?? 0}
                limit={usageData?.usage?.companySearches?.limit ?? 0}
                color="blue"
              />
              <StatCard
                label="AI Features"
                icon={Brain}
                used={usageData?.usage?.aiUsages?.used ?? 0}
                limit={usageData?.usage?.aiUsages?.limit ?? 0}
                color="violet"
              />
              <StatCard
                label="Exports"
                icon={Download}
                used={usageData?.usage?.exports?.used ?? 0}
                limit={usageData?.usage?.exports?.limit ?? 0}
                color="emerald"
              />
            </div>
          </>
        )}
      </div>

      {/* ── Member usage breakdown ───────────────────────────────────── */}
      {usageData?.memberBreakdown && usageData.memberBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Usage by Member</CardTitle>
            <CardDescription>Breakdown of this billing period&apos;s usage per team member.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b bg-muted/40">
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Member</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Feature</th>
                    <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {usageData.memberBreakdown.map((m, i) => (
                    <tr key={`${m.userId}-${m.feature}-${i}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="size-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            {(m.name || m.email).split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{m.name}</p>
                            <p className="text-[11px] text-muted-foreground">{m.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className="text-[11px] font-normal capitalize">
                          {m.feature.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-semibold">
                        {m.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Plans ────────────────────────────────────────────────────── */}
      <div>
        <div className="mb-5">
          <h2 className="text-xl font-bold tracking-tight">Plans</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose the plan that fits your team. Upgrade or downgrade anytime.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {(["free", "go", "flow", "enterprise"] as PlanId[]).map((planId) => (
            <PlanCard
              key={planId}
              planId={planId}
              currentPlan={currentPlan}
              onSelect={handlePlanChange}
              isChanging={changePlan.isPending}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
