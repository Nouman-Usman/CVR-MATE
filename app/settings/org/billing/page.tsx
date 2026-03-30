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
  useCheckout,
  useCustomerPortal,
  useCancelSubscription,
  useResumeSubscription,
  useChangePlan,
} from "@/lib/hooks/use-subscription";
import { PLANS, type PlanId, PLAN_LIMITS } from "@/lib/stripe/plans";
import {
  CreditCard,
  Users,
  Zap,
  Search,
  Brain,
  Download,
  Link2,
  Shield,
  Crown,
  ArrowUpRight,
  Check,
  AlertTriangle,
  TrendingUp,
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

// ─── Usage bar ──────────────────────────────────────────────────────────────

function UsageBar({
  label,
  icon: Icon,
  used,
  limit,
}: {
  label: string;
  icon: typeof Search;
  used: number;
  limit: number;
}) {
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 0 : limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isHigh = pct >= 80;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-muted-foreground" />
          {label}
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {used.toLocaleString()}
          {isUnlimited ? (
            <span className="text-xs ml-1">/ unlimited</span>
          ) : (
            <span className="text-xs ml-1">/ {limit.toLocaleString()}</span>
          )}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isHigh
                ? "bg-gradient-to-r from-amber-500 to-red-500"
                : "bg-gradient-to-r from-blue-500 to-cyan-400"
            }`}
            style={{ width: `${Math.max(pct, 1)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Plan card ──────────────────────────────────────────────────────────────

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
  const isCurrent = planId === currentPlan;
  const isEnterprise = planId === "enterprise";

  const features = [
    { label: `${limits.maxSeats === Infinity ? "Unlimited" : limits.maxSeats} seats`, included: true },
    { label: `${limits.companySearchesPerMonth === Infinity ? "Unlimited" : limits.companySearchesPerMonth} searches/mo`, included: true },
    { label: `${limits.triggers === Infinity ? "Unlimited" : limits.triggers} triggers`, included: limits.triggers > 0 },
    { label: "AI features", included: limits.aiFeatures },
    { label: "CRM integrations", included: limits.crm },
    { label: "Data exports", included: limits.exports },
    { label: "Team features", included: limits.teamFeatures },
    { label: "Priority support", included: limits.prioritySupport },
    { label: "SSO / SAML", included: limits.sso },
    { label: "API access", included: limits.apiAccess },
    { label: "Audit log", included: limits.auditLog },
  ];

  return (
    <Card className={`relative ${isCurrent ? "border-primary ring-1 ring-primary/20" : ""}`}>
      {isCurrent && (
        <div className="absolute -top-3 left-4">
          <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5">
            Current plan
          </Badge>
        </div>
      )}
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          {planId === "free" && <Zap className="size-5 text-slate-400" />}
          {planId === "go" && <TrendingUp className="size-5 text-blue-500" />}
          {planId === "flow" && <Crown className="size-5 text-violet-500" />}
          {planId === "enterprise" && <Shield className="size-5 text-amber-500" />}
          <CardTitle className="text-lg">{plan.name}</CardTitle>
        </div>
        <div className="mt-2">
          {isEnterprise ? (
            <p className="text-2xl font-bold">Custom</p>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums">
                {plan.price.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">
                {plan.currency}/mo
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {features.map((f) => (
            <li
              key={f.label}
              className={`flex items-center gap-2 text-sm ${
                f.included ? "text-foreground" : "text-muted-foreground/50 line-through"
              }`}
            >
              <Check
                className={`size-3.5 shrink-0 ${
                  f.included ? "text-emerald-500" : "text-muted-foreground/30"
                }`}
              />
              {f.label}
            </li>
          ))}
        </ul>

        {isEnterprise ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open("mailto:sales@cvr-mate.dk?subject=Enterprise%20Plan", "_blank")}
          >
            Contact Sales
            <ArrowUpRight className="size-4 ml-1" />
          </Button>
        ) : isCurrent ? (
          <Button variant="outline" className="w-full" disabled>
            Current Plan
          </Button>
        ) : (
          <Button
            variant={planId === "flow" ? "gradient" : "default"}
            className="w-full"
            onClick={() => onSelect(planId)}
            disabled={isChanging}
          >
            {isChanging ? "Changing..." : currentPlan === "free" ? "Upgrade" : "Switch"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { data: sub, isLoading: subLoading } = useSubscription();
  const checkout = useCheckout();
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
    if (target === "enterprise") return; // enterprise is contact-sales only
    try {
      await changePlan.mutateAsync(target as "free" | "go" | "flow");
      toast.success(`Plan changed to ${PLANS[target].name}`);
      fetchUsage();
    } catch (err: any) {
      toast.error(err.message || "Failed to change plan");
    }
  }

  return (
    <div className="space-y-6">
      {/* Current Plan + Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Billing & Usage</CardTitle>
              <CardDescription>
                Manage your workspace subscription and monitor usage.
              </CardDescription>
            </div>
            {sub?.plan !== "free" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
              >
                <CreditCard className="size-4 mr-1.5" />
                {portal.isPending ? "Opening..." : "Manage Billing"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-4 w-48" />
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Plan badge + status */}
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="text-base px-3 py-1 font-semibold">
                  {PLANS[currentPlan]?.name ?? "Free"}
                </Badge>
                {sub?.status === "active" && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                    Active
                  </Badge>
                )}
                {sub?.status === "past_due" && (
                  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                    <AlertTriangle className="size-3 mr-1" />
                    Past Due
                  </Badge>
                )}
                {sub?.cancelAtPeriodEnd && (
                  <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                    Cancels at period end
                  </Badge>
                )}
                {sub?.currentPeriodEnd && (
                  <span className="text-xs text-muted-foreground">
                    Renews {new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </div>

              {/* Cancel / Resume */}
              {sub?.plan !== "free" && (
                <div className="flex gap-2">
                  {sub?.cancelAtPeriodEnd ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resume.mutate()}
                      disabled={resume.isPending}
                    >
                      {resume.isPending ? "Resuming..." : "Resume Subscription"}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm("Are you sure you want to cancel? You'll retain access until the end of your billing period.")) {
                          cancel.mutate();
                        }
                      }}
                      disabled={cancel.isPending}
                    >
                      {cancel.isPending ? "Cancelling..." : "Cancel Subscription"}
                    </Button>
                  )}
                </div>
              )}

              <Separator />

              {/* Seats */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Seats</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold tabular-nums">
                    {usageData?.seats?.current ?? 1}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {usageData?.seats?.max === -1 ? "unlimited" : usageData?.seats?.max ?? 1}
                  </span>
                </div>
              </div>

              {/* Usage meters */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Monthly Usage</h3>
                <UsageBar
                  label="Company Searches"
                  icon={Search}
                  used={usageData?.usage?.companySearches?.used ?? sub?.usage?.companySearches?.used ?? 0}
                  limit={usageData?.usage?.companySearches?.limit ?? sub?.usage?.companySearches?.limit ?? 0}
                />
                <UsageBar
                  label="AI Features"
                  icon={Brain}
                  used={usageData?.usage?.aiUsages?.used ?? sub?.usage?.aiUsages?.used ?? 0}
                  limit={usageData?.usage?.aiUsages?.limit ?? sub?.usage?.aiUsages?.limit ?? 0}
                />
                <UsageBar
                  label="Exports"
                  icon={Download}
                  used={usageData?.usage?.exports?.used ?? sub?.usage?.exports?.used ?? 0}
                  limit={usageData?.usage?.exports?.limit ?? sub?.usage?.exports?.limit ?? 0}
                />
              </div>

              {/* Member breakdown */}
              {usageData?.memberBreakdown && usageData.memberBreakdown.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Usage by Member</h3>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Member</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Feature</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usageData.memberBreakdown.map((m, i) => (
                            <tr key={`${m.userId}-${m.feature}-${i}`} className="border-b last:border-0">
                              <td className="py-2 px-3">
                                <div>
                                  <p className="font-medium">{m.name}</p>
                                  <p className="text-xs text-muted-foreground">{m.email}</p>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <Badge variant="outline" className="text-xs font-normal">
                                  {m.feature.replace("_", " ")}
                                </Badge>
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums font-medium">
                                {m.count}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans comparison */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
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
