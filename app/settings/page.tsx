"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { authClient } from "@/lib/auth-client";
import { useLanguage } from "@/lib/i18n/language-context";
import { VideoTrigger } from "@/components/videos/VideoTrigger";
import DashboardLayout from "@/components/dashboard-layout";
import Link from "next/link";
import CrmIntegrationsSectionComponent from "@/components/settings/crm-integrations-section";
import TeamSection from "@/components/settings/team-section";
import { SettingsVideosSection } from "@/components/settings/SettingsVideosSection";
import {
  useSubscription,
  useCheckout,
  useCustomerPortal,
  useCancelSubscription,
  useResumeSubscription,
} from "@/lib/hooks/use-subscription";
import { useEmailClientValue, useSetEmailClient, type EmailClient } from "@/lib/hooks/use-email-client";
import { useSetLanguage } from "@/lib/hooks/use-language";
import { useOrganization } from "@/lib/hooks/use-team";
import { cn } from "@/lib/utils";
import {
  User,
  Lock,
  Building2,
  UsersRound,
  Bell,
  Globe,
  Plug,
  CreditCard,
  AlertTriangle,
  ChevronDown,
  Loader2,
  X,
  Film,
} from "lucide-react";

type SettingsSection =
  | "profile"
  | "password"
  | "brand"
  | "team"
  | "notifications"
  | "language"
  | "integrations"
  | "subscription"
  | "videos"
  | "danger";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
        checked ? "bg-blue-600" : "bg-slate-200"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}


// ─── Subscription Section ─────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  free: { bg: "bg-slate-100", text: "text-slate-700" },
  starter: { bg: "bg-blue-50", text: "text-blue-700" },
  professional: { bg: "bg-violet-50", text: "text-violet-700" },
  enterprise: { bg: "bg-amber-50", text: "text-amber-700" },
};

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-blue-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className="text-xs text-slate-400">
          {isUnlimited ? (
            <span className="text-emerald-600 font-medium">Unlimited</span>
          ) : (
            <>{used} / {limit}</>
          )}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function SubscriptionSection() {
  const { t, locale } = useLanguage();
  const st = t.settings;
  const sub = st.subscription as Record<string, unknown>;
  const { data, isLoading } = useSubscription();
  const portalMutation = useCustomerPortal();
  const cancelMutation = useCancelSubscription();
  const resumeMutation = useResumeSubscription();
  const checkoutMutation = useCheckout();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [subToast, setSubToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showSubToast = (msg: string, type: "success" | "error" = "success") => {
    setSubToast({ msg, type });
    setTimeout(() => setSubToast(null), 4000);
  };

  const cardClass =
    "bg-white rounded-2xl shadow-sm border border-slate-100/60 p-4 sm:p-6 md:p-8";

  const plan = data?.plan ?? "free";
  const planColor = PLAN_COLORS[plan] ?? PLAN_COLORS.free;

  const isPaid = plan !== "free";
  const isPastDue = data?.status === "past_due";
  const isCanceling = data?.cancelAtPeriodEnd === true;

  const nextBillingDate = data?.currentPeriodEnd
    ? new Date(data.currentPeriodEnd).toLocaleDateString(
        locale === "da" ? "da-DK" : "en-US",
        { year: "numeric", month: "long", day: "numeric" }
      )
    : null;

  const anyMutationPending =
    portalMutation.isPending || cancelMutation.isPending ||
    resumeMutation.isPending || checkoutMutation.isPending;

  return (
    <>
    {/* Subscription toast */}
    {subToast && (
      <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 ${
        subToast.type === "error" ? "bg-red-600 text-white" : "bg-foreground text-background"
      }`}>
        <span className="material-symbols-outlined text-base">
          {subToast.type === "error" ? "error" : "check_circle"}
        </span>
        {subToast.msg}
      </div>
    )}
    <div className={cardClass}>
      <div className="flex items-center gap-2 mb-6">
        <span className="material-symbols-outlined text-slate-400 text-xl">
          credit_card
        </span>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          {sub.title as string}
        </h2>
      </div>

      {isLoading ? (
        <div className="bg-slate-50 rounded-xl p-6 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Past-due warning */}
          {isPastDue && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-red-500 text-lg mt-0.5 shrink-0">error</span>
              <div>
                <p className="text-sm font-semibold text-red-700">{sub.pastDueWarning as string}</p>
                <button
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  className="mt-2 text-sm font-medium text-red-600 hover:text-red-800 underline cursor-pointer"
                >
                  {sub.updatePayment as string}
                </button>
              </div>
            </div>
          )}

          {/* Cancel notice with resume button + hint to pick a new plan */}
          {isCanceling && !isPastDue && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-500 text-lg mt-0.5 shrink-0">schedule</span>
              <div className="flex-1">
                <p className="text-sm text-amber-700">{sub.cancelNotice as string}</p>
                <p className="text-xs text-amber-600 mt-1">
                  {locale === "da"
                    ? "Du kan nu vælge en ny plan nedenfor, eller genoptage din nuværende plan."
                    : "You can now subscribe to a different plan below, or resume your current plan."}
                </p>
                <button
                  onClick={() => resumeMutation.mutate(undefined, {
                    onSuccess: () => showSubToast(locale === "da" ? "Abonnement genoptaget" : "Subscription resumed"),
                    onError: (err) => showSubToast(err.message || "Failed to resume", "error"),
                  })}
                  disabled={resumeMutation.isPending}
                  className="mt-2 px-4 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-full hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {resumeMutation.isPending ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  ) : (
                    sub.resumeSubscription as string
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Current plan card */}
          <div className="rounded-xl overflow-hidden mb-4">
            <div className={`px-6 py-4 ${planColor.bg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${planColor.text}`}>
                    {data?.planName ?? "Free"}
                  </span>
                  {isPaid && data?.price != null && (
                    <span className="text-sm font-semibold text-slate-600">
                      {data.price.toLocaleString(locale === "da" ? "da-DK" : "en-US")} {data.currency}{sub.perMonth as string}
                    </span>
                  )}
                </div>
                {isPaid && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => portalMutation.mutate(undefined, {
                        onError: (err) => showSubToast(err.message || "Failed to open billing portal", "error"),
                      })}
                      disabled={anyMutationPending}
                      className="px-3 py-1.5 bg-white/80 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {portalMutation.isPending ? (
                        <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        sub.manageBilling as string
                      )}
                    </button>
                    {!isCanceling && (
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        disabled={anyMutationPending}
                        className="px-3 py-1.5 bg-white/80 border border-red-200 rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {sub.cancelSubscription as string}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {nextBillingDate && isPaid && !isCanceling && (
                <p className="text-[11px] text-slate-500 mt-2">
                  {sub.nextBilling as string}: {nextBillingDate}
                </p>
              )}
              {!isPaid && (
                <p className="text-xs text-slate-500 mt-1">{sub.freePlan as string}</p>
              )}
            </div>
          </div>

          {/* Cancel confirmation dialog */}
          {showCancelConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-4">
              <h3 className="text-sm font-bold text-red-800 mb-1">{sub.cancelConfirmTitle as string}</h3>
              <p className="text-sm text-red-600 mb-4">{sub.cancelConfirmBody as string}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    cancelMutation.mutate(undefined, {
                      onSuccess: () => {
                        setShowCancelConfirm(false);
                        showSubToast(locale === "da" ? "Abonnement annulleret" : "Subscription canceled");
                      },
                      onError: (err) => showSubToast(err.message || "Failed to cancel", "error"),
                    });
                  }}
                  disabled={cancelMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-full hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {cancelMutation.isPending ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  ) : (
                    sub.cancelConfirm as string
                  )}
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="px-4 py-2 border-2 border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {sub.cancelDismiss as string}
                </button>
              </div>
            </div>
          )}

          {/* Monthly usage meters */}
          {data?.usage && (
            <div className="bg-slate-50 rounded-xl p-5 mb-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                {sub.usageTitle as string}
              </h3>
              <div className="space-y-3">
                <UsageMeter
                  label={locale === "da" ? "Virksomhedssøgninger" : "Company searches"}
                  used={data.usage.companySearches?.used ?? 0}
                  limit={data.usage.companySearches?.limit ?? 0}
                />
                <UsageMeter
                  label={locale === "da" ? "AI brug" : "AI usages"}
                  used={data.usage.aiUsages?.used ?? 0}
                  limit={data.usage.aiUsages?.limit ?? 0}
                />
                <UsageMeter
                  label={locale === "da" ? "Berigelser" : "Enrichments"}
                  used={data.usage.enrichments?.used ?? 0}
                  limit={data.usage.enrichments?.limit ?? 0}
                />
                <UsageMeter
                  label={locale === "da" ? "E-mail udkast" : "Email drafts"}
                  used={data.usage.emailDrafts?.used ?? 0}
                  limit={data.usage.emailDrafts?.limit ?? 0}
                />
                <UsageMeter
                  label={locale === "da" ? "Eksport" : "Exports"}
                  used={data.usage.exports?.used ?? 0}
                  limit={data.usage.exports?.limit ?? 0}
                />
              </div>
            </div>
          )}

          {/* Plan options — 3 states: active (no grid), canceling (show grid), free (show grid) */}
          {(() => {
            // Active paid user who hasn't canceled — show info message instead of grid
            if (isPaid && !isCanceling) {
              return (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-start gap-3">
                  <span className="material-symbols-outlined text-slate-400 text-lg mt-0.5 shrink-0">info</span>
                  <p className="text-sm text-slate-600">
                    {locale === "da"
                      ? "Opsig din nuværende plan først for at skifte til en anden plan."
                      : "Cancel your current plan first to switch to a different plan."}
                  </p>
                </div>
              );
            }

            // Helper: resolve (plan, interval) → Stripe price ID
            const getPriceId = (p: string, interval: "monthly" | "annual"): string | null => {
              const map: Record<string, Record<string, string | undefined>> = {
                starter: {
                  monthly: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID,
                  annual: process.env.NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID,
                },
                professional: {
                  monthly: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
                  annual: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID,
                },
                enterprise: {
                  monthly: process.env.NEXT_PUBLIC_STRIPE_ENT_MONTHLY_PRICE_ID,
                  annual: process.env.NEXT_PUBLIC_STRIPE_ENT_ANNUAL_PRICE_ID,
                },
              };
              return map[p]?.[interval] ?? null;
            };

            return (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {isCanceling
                      ? (locale === "da" ? "Vælg en ny plan" : "Choose a new plan")
                      : (sub.upgrade as string)}
                  </h3>
                  {/* Monthly / Annual toggle */}
                  <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 rounded-full p-0.5 gap-0.5">
                      <button
                        onClick={() => setBillingInterval("monthly")}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                          billingInterval === "monthly"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {locale === "da" ? "Månedlig" : "Monthly"}
                      </button>
                      <button
                        onClick={() => setBillingInterval("annual")}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          billingInterval === "annual"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {locale === "da" ? "Årlig" : "Annual"}
                        <span className="inline-flex px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold">
                          -20%
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(["starter", "professional", "enterprise"] as const)
                    .filter((p) => p !== plan)
                    .map((targetPlan) => {
                      const colors = PLAN_COLORS[targetPlan];
                      const monthlyPrices: Record<string, number> = { starter: 299, professional: 699, enterprise: 1699 };
                      const annualPrices: Record<string, number> = { starter: 239, professional: 559, enterprise: 1359 };
                      const names: Record<string, string> = { starter: "Starter", professional: "Professional", enterprise: "Enterprise" };
                      const descs: Record<string, string> = {
                        starter: locale === "da" ? "Solo-prospektering" : "Solo prospecting",
                        professional: locale === "da" ? "For salgsteams" : "For sales teams",
                        enterprise: locale === "da" ? "Teams & bureauer" : "Teams & agencies",
                      };
                      const price = billingInterval === "annual" ? annualPrices[targetPlan] : monthlyPrices[targetPlan];
                      const priceId = getPriceId(targetPlan, billingInterval);

                      return (
                        <button
                          key={targetPlan}
                          onClick={() => {
                            if (!priceId) {
                              showSubToast(locale === "da" ? "Pris ikke tilgængelig" : "Price not available", "error");
                              return;
                            }
                            checkoutMutation.mutate(priceId, {
                              onError: (err) => showSubToast(err.message || (locale === "da" ? "Kunne ikke starte checkout" : "Failed to start checkout"), "error"),
                            });
                          }}
                          disabled={anyMutationPending || !priceId}
                          className={`flex flex-col p-5 rounded-xl border-2 hover:shadow-md transition-all cursor-pointer disabled:opacity-50 text-left group ${
                            targetPlan === "professional" ? "border-violet-200 hover:border-violet-400 hover:bg-violet-50/30" :
                            targetPlan === "enterprise" ? "border-amber-200 hover:border-amber-400 hover:bg-amber-50/30" :
                            "border-blue-200 hover:border-blue-400 hover:bg-blue-50/30"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-3">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors.bg} ${colors.text}`}>
                              {names[targetPlan]}
                            </span>
                            {checkoutMutation.isPending ? (
                              <Loader2 className="size-4 animate-spin text-slate-400" />
                            ) : (
                              <span className="material-symbols-outlined text-sm text-slate-300 group-hover:text-slate-500 transition-colors">arrow_forward</span>
                            )}
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-black text-slate-900">{price.toLocaleString()}</span>
                            <span className="text-sm font-medium text-slate-400">DKK{sub.perMonth as string}</span>
                          </div>
                          {billingInterval === "annual" ? (
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-slate-400 line-through">{monthlyPrices[targetPlan].toLocaleString()} DKK</span>
                              <span className="text-[10px] text-emerald-600 font-bold">
                                {(annualPrices[targetPlan] * 12).toLocaleString()} DKK/{locale === "da" ? "år" : "yr"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 mt-0.5">
                              {(monthlyPrices[targetPlan] * 12).toLocaleString()} DKK/{locale === "da" ? "år" : "yr"}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500 mt-1">{descs[targetPlan]}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
    </>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t, locale, toggleLocale } = useLanguage();
  const { data: session } = useSession();
  const st = t.settings;

  // Email client preference
  const emailClient = useEmailClientValue();
  const setEmailClientMutation = useSetEmailClient();

  // Language preference
  const setLanguageMutation = useSetLanguage();

  // Profile
  const [name, setName] = useState(session?.user?.name || "");
  const [profileSaving, setProfileSaving] = useState(false);

  // Notifications
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [triggerAlerts, setTriggerAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isOAuthUser, setIsOAuthUser] = useState(false);

  // Brand state
  const [brandLoaded, setBrandLoaded] = useState(false);
  const [hasBrand, setHasBrand] = useState(false);
  const [brandCompanyName, setBrandCompanyName] = useState("");
  const [brandCvr, setBrandCvr] = useState("");
  const [brandIndustry, setBrandIndustry] = useState("");
  const [brandCompanySize, setBrandCompanySize] = useState("");
  const [brandWebsite, setBrandWebsite] = useState("");
  const [brandProducts, setBrandProducts] = useState("");
  const [brandTargetAudience, setBrandTargetAudience] = useState("");
  const [brandTone, setBrandTone] = useState("formal");
  const [brandSaving, setBrandSaving] = useState(false);
  const [cvrLoading, setCvrLoading] = useState(false);
  const [cvrStatus, setCvrStatus] = useState<"idle" | "found" | "notfound">(
    "idle"
  );

  // AI Enrichment questionnaire
  interface EnrichQuestion { id: string; question: string; placeholder: string }
  const [enrichStep, setEnrichStep] = useState<"idle" | "questions" | "answering" | "generating" | "done">("idle");
  const [enrichQuestions, setEnrichQuestions] = useState<EnrichQuestion[]>([]);
  const [enrichAnswers, setEnrichAnswers] = useState<Record<string, string>>({});
  const [enrichCurrentQ, setEnrichCurrentQ] = useState(0);
  const [aiEnrichmentData, setAiEnrichmentData] = useState<Record<string, unknown> | null>(null);
  const [enrichSaving, setEnrichSaving] = useState(false);

  // ── Helpers ─────────────────────────────────────────────────────────────

  const showToast = useCallback(
    (msg: string, type: "success" | "error" = "success") => {
      setToast(msg);
      setToastType(type);
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  // ── Sync name from session ──────────────────────────────────────────────

  useEffect(() => {
    if (session?.user?.name && !name) {
      setName(session.user.name);
    }
  }, [session?.user?.name, name]);

  // ── Load brand data ─────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/brand")
      .then((res) => res.json())
      .then((data) => {
        if (data.brand) {
          setHasBrand(true);
          setBrandCompanyName(data.brand.companyName || "");
          setBrandCvr(data.brand.cvr || "");
          setBrandIndustry(data.brand.industry || "");
          setBrandCompanySize(data.brand.companySize || "");
          setBrandWebsite(data.brand.website || "");
          setBrandProducts(data.brand.products || "");
          setBrandTargetAudience(data.brand.targetAudience || "");
          setBrandTone(data.brand.tone || "formal");
          if (data.brand.aiEnrichment) {
            setAiEnrichmentData(data.brand.aiEnrichment as Record<string, unknown>);
            setEnrichStep("done");
          }
        }
        setBrandLoaded(true);
      })
      .catch(() => setBrandLoaded(true));
  }, []);

  // ── Check if OAuth user (no password to change) ─────────────────────────

  useEffect(() => {
    if (!session?.user?.id) return;
    // If user signed up via Google OAuth, there's no credential account
    // We check by trying to see if they have a "credential" provider account
    // Simple heuristic: if email is verified but they never set a password
    // Better approach: check accounts via session
    fetch("/api/auth/list-accounts", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          const hasCredential = data.some?.(
            (a: { providerId: string }) => a.providerId === "credential"
          );
          setIsOAuthUser(!hasCredential);
        }
      })
      .catch(() => {});
  }, [session?.user?.id]);


  // ── Profile save ────────────────────────────────────────────────────────

  const handleProfileSave = async () => {
    if (!name.trim()) return;
    setProfileSaving(true);
    try {
      await authClient.updateUser({ name: name.trim() });
      showToast(st.saved);
    } catch {
      showToast(locale === "da" ? "Kunne ikke gemme" : "Failed to save", "error");
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Password change ─────────────────────────────────────────────────────

  const handlePasswordChange = async () => {
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError(st.password.tooShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(st.password.mismatch);
      return;
    }

    setPasswordChanging(true);
    try {
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (res.error) {
        setPasswordError(st.password.wrongCurrent);
      } else {
        showToast(st.password.changed);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordError(st.password.wrongCurrent);
    } finally {
      setPasswordChanging(false);
    }
  };

  // ── Brand CVR lookup ────────────────────────────────────────────────────

  const handleBrandCvrLookup = async () => {
    if (!/^\d{8}$/.test(brandCvr)) return;
    setCvrLoading(true);
    setCvrStatus("idle");
    try {
      const res = await fetch("/api/brand/cvr-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat: brandCvr }),
      });
      if (!res.ok) {
        setCvrStatus("notfound");
        return;
      }
      const data = await res.json();
      if (data.companyName) setBrandCompanyName(data.companyName);
      if (data.industry) setBrandIndustry(data.industry);
      if (data.employees) {
        const emp = data.employees;
        if (emp <= 4) setBrandCompanySize("1-4");
        else if (emp <= 9) setBrandCompanySize("5-9");
        else if (emp <= 19) setBrandCompanySize("10-19");
        else if (emp <= 49) setBrandCompanySize("20-49");
        else if (emp <= 99) setBrandCompanySize("50-99");
        else setBrandCompanySize("100+");
      }
      if (data.website) setBrandWebsite(data.website);
      setCvrStatus("found");
    } catch {
      setCvrStatus("notfound");
    } finally {
      setCvrLoading(false);
    }
  };

  // ── Brand save ──────────────────────────────────────────────────────────

  const handleBrandSave = async () => {
    if (!brandCompanyName.trim() || !brandProducts.trim()) return;
    setBrandSaving(true);
    try {
      const method = hasBrand ? "PATCH" : "POST";
      const res = await fetch("/api/brand", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: brandCompanyName,
          cvr: brandCvr || null,
          industry: brandIndustry || null,
          companySize: brandCompanySize || null,
          website: brandWebsite || null,
          products: brandProducts,
          targetAudience: brandTargetAudience || null,
          tone: brandTone,
        }),
      });
      if (res.ok) {
        setHasBrand(true);
        sessionStorage.setItem("onboarding_complete", "true");
        showToast(st.brand.saved);
      }
    } catch {
      showToast(
        locale === "da" ? "Kunne ikke gemme" : "Failed to save",
        "error"
      );
    } finally {
      setBrandSaving(false);
    }
  };


  // ── Render ──────────────────────────────────────────────────────────────

  // Deep-link via ?tab= (e.g., OAuth callback redirects to ?tab=integrations)
  // Must use useEffect to avoid hydration mismatch — server always renders "profile"
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    const valid: SettingsSection[] = ["profile", "password", "brand", "team", "notifications", "language", "integrations", "subscription", "danger"];
    if (tab && valid.includes(tab as SettingsSection)) {
      setActiveSection(tab as SettingsSection);
    }
  }, []);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["account", "workspace", "billing"]));

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  // Check if user is an org member (non-owner)
  const { data: teamData } = useOrganization(session?.user?.id);
  const isOrgMember = !!teamData?.myRole && !teamData?.isOwner;
  const isOwner = teamData?.isOwner === true;

  const userEmail = session?.user?.email || "";
  const initials = (session?.user?.name || userEmail)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const cardClass =
    "bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-4 sm:p-6 md:p-8";
  const labelClass =
    "text-xs font-bold uppercase tracking-wider text-slate-400 px-1";
  const inputClass =
    "w-full bg-slate-50 border-none rounded-lg py-3 px-4 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none";
  const btnPrimary =
    "px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-full hover:scale-[1.02] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";

  const sidebarGroups: {
    key: string;
    label: string;
    items: { key: SettingsSection; label: string; icon: typeof User }[];
  }[] = [
    {
      key: "account",
      label: locale === "da" ? "Konto" : "Account",
      items: [
        { key: "profile", label: st.profile.title, icon: User },
        { key: "password", label: st.password.title, icon: Lock },
        { key: "notifications", label: st.notifications.title, icon: Bell },
        { key: "language", label: st.language.title, icon: Globe },
      ],
    },
    {
      key: "workspace",
      label: locale === "da" ? "Arbejdsplads" : "Workspace",
      items: [
        { key: "brand", label: st.brand.title, icon: Building2 },
        { key: "team", label: st.team.title, icon: UsersRound },
        { key: "integrations", label: (t.integrations as { title: string }).title, icon: Plug },
      ],
    },
    {
      key: "billing",
      label: locale === "da" ? "Betaling" : "Billing",
      items: [
        ...(isOrgMember ? [] : [{ key: "subscription" as SettingsSection, label: (st.subscription as { title: string }).title, icon: CreditCard }]),
        ...(isOwner ? [{ key: "videos" as SettingsSection, label: locale === "da" ? "Videoer" : "Videos", icon: Film }] : []),
        { key: "danger", label: st.danger.title, icon: AlertTriangle },
      ],
    },
  ];

  return (
    <VideoTrigger featureKey="settings">
      <DashboardLayout>
        {/* Toast */}
        {toast && (
        <div
          className={cn(
            "fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300",
            toastType === "error" ? "bg-destructive text-destructive-foreground" : "bg-foreground text-background"
          )}
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)]">
          {st.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">{st.subtitle}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Sidebar ──────────────────────────────────────────── */}
        <nav className="lg:w-60 shrink-0">
          <div className="lg:sticky lg:top-6 space-y-1">
            {sidebarGroups.map((group) => (
              <div key={group.key}>
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {group.label}
                  <ChevronDown className={cn(
                    "size-3.5 transition-transform duration-200",
                    expandedGroups.has(group.key) ? "rotate-0" : "-rotate-90"
                  )} />
                </button>
                {expandedGroups.has(group.key) && (
                  <div className="space-y-0.5 mb-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeSection === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setActiveSection(item.key)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
                            isActive
                              ? "bg-primary/5 text-primary"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          )}
                        >
                          <Icon className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground/60")} />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* ── Content ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 max-w-3xl">
        {/* ── Profile ──────────────────────────────────────────────────── */}
        {activeSection === "profile" && <div className={cardClass}>
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-slate-400 text-xl">
              person
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {st.profile.title}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shrink-0 ring-4 ring-slate-100 shadow-lg">
              {initials}
            </div>
            <div className="flex-1 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="space-y-1.5">
                  <label className={labelClass}>{st.profile.name}</label>
                  <input
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>{st.profile.email}</label>
                  <input
                    className="w-full bg-slate-50 border-none rounded-lg py-3 px-4 text-sm text-slate-400 cursor-not-allowed"
                    value={userEmail}
                    disabled
                  />
                </div>
              </div>
              <button
                onClick={handleProfileSave}
                disabled={profileSaving || !name.trim()}
                className={btnPrimary}
              >
                {profileSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-sm">
                      progress_activity
                    </span>
                    {locale === "da" ? "Gemmer..." : "Saving..."}
                  </span>
                ) : (
                  st.profile.save
                )}
              </button>
            </div>
          </div>
        </div>}

        {/* ── Change Password ──────────────────────────────────────────── */}
        {activeSection === "password" && <div className={cardClass}>
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-slate-400 text-xl">
              lock
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {st.password.title}
            </h2>
          </div>

          {isOAuthUser ? (
            <div className="bg-slate-50 rounded-xl p-5 flex items-start gap-3">
              <span className="material-symbols-outlined text-slate-400 text-xl shrink-0 mt-0.5">
                info
              </span>
              <p className="text-sm text-slate-500">{st.password.oauthOnly}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                  <span className="material-symbols-outlined text-red-500 text-lg shrink-0 mt-0.5">
                    error
                  </span>
                  {passwordError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className={labelClass}>{st.password.current}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-lg">
                      lock
                    </span>
                  </div>
                  <input
                    className="w-full bg-slate-50 border-none rounded-lg py-3 pl-11 pr-4 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>{st.password.new}</label>
                  <input
                    className={inputClass}
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={8}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>{st.password.confirm}</label>
                  <input
                    className={inputClass}
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500 flex items-center gap-1 px-1">
                  <span className="material-symbols-outlined text-sm">
                    warning
                  </span>
                  {st.password.mismatch}
                </p>
              )}

              <button
                onClick={handlePasswordChange}
                disabled={
                  passwordChanging ||
                  !currentPassword ||
                  !newPassword ||
                  newPassword !== confirmPassword ||
                  newPassword.length < 8
                }
                className={btnPrimary}
              >
                {passwordChanging ? (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-sm">
                      progress_activity
                    </span>
                    {st.password.changing}
                  </span>
                ) : (
                  st.password.change
                )}
              </button>
            </div>
          )}
        </div>}

        {/* ── Company Profile / Brand ──────────────────────────────────── */}
        {activeSection === "brand" && <div className={cardClass}>
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-slate-400 text-xl">
              apartment
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {st.brand.title}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mb-6">{st.brand.subtitle}</p>

          {brandLoaded && !hasBrand && !brandCompanyName ? (
            <div className="bg-slate-50 rounded-xl p-6 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">
                auto_awesome
              </span>
              <p className="text-sm text-slate-500 mb-4">
                {st.brand.notSetup}
              </p>
              <Link
                href="/onboarding"
                className={`inline-block ${btnPrimary}`}
              >
                {st.brand.setupNow}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* CVR Lookup */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-lg">
                      tag
                    </span>
                  </div>
                  <input
                    className="w-full bg-slate-50 border-none rounded-lg py-3 pl-11 pr-4 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder={t.onboarding.cvrPlaceholder}
                    maxLength={8}
                    value={brandCvr}
                    onChange={(e) => {
                      setBrandCvr(e.target.value.replace(/\D/g, ""));
                      setCvrStatus("idle");
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleBrandCvrLookup}
                  disabled={!/^\d{8}$/.test(brandCvr) || cvrLoading}
                  className="px-4 py-2.5 bg-slate-200 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                >
                  {cvrLoading ? (
                    <span className="material-symbols-outlined animate-spin text-sm">
                      progress_activity
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-sm">
                      search
                    </span>
                  )}
                  {t.onboarding.cvrLookup}
                </button>
              </div>
              {cvrStatus === "found" && (
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 -mt-2">
                  <span className="material-symbols-outlined text-sm">
                    check_circle
                  </span>
                  {t.onboarding.cvrFound}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    {t.onboarding.companyName}{" "}
                    <span className="text-red-400">*</span>
                  </label>
                  <input
                    className={inputClass}
                    value={brandCompanyName}
                    onChange={(e) => setBrandCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>{t.onboarding.industry}</label>
                  <input
                    className={inputClass}
                    value={brandIndustry}
                    onChange={(e) => setBrandIndustry(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    {t.onboarding.companySize}
                  </label>
                  <select
                    className={`${inputClass} appearance-none`}
                    value={brandCompanySize}
                    onChange={(e) => setBrandCompanySize(e.target.value)}
                  >
                    <option value="">
                      {t.onboarding.companySizePlaceholder}
                    </option>
                    {t.onboarding.sizes.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>{t.onboarding.website}</label>
                  <input
                    className={inputClass}
                    value={brandWebsite}
                    onChange={(e) => setBrandWebsite(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>
                  {t.onboarding.products}{" "}
                  <span className="text-red-400">*</span>
                </label>
                <textarea
                  className={`${inputClass} min-h-[80px] resize-y`}
                  value={brandProducts}
                  onChange={(e) => setBrandProducts(e.target.value)}
                  placeholder={t.onboarding.productsPlaceholder}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>
                  {t.onboarding.targetAudience}
                </label>
                <textarea
                  className={`${inputClass} min-h-[60px] resize-y`}
                  value={brandTargetAudience}
                  onChange={(e) => setBrandTargetAudience(e.target.value)}
                  placeholder={t.onboarding.targetAudiencePlaceholder}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>
                  {locale === "da" ? "AI Tone" : "AI Tone"}
                </label>
                <div className="flex gap-2">
                  {(["formal", "friendly", "casual"] as const).map((tn) => {
                    const labels = {
                      formal: t.onboarding.toneFormal,
                      friendly: t.onboarding.toneFriendly,
                      casual: t.onboarding.toneCasual,
                    };
                    return (
                      <button
                        key={tn}
                        type="button"
                        onClick={() => setBrandTone(tn)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                          brandTone === tn
                            ? "bg-blue-50 text-blue-600 ring-2 ring-blue-500/20"
                            : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {labels[tn]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleBrandSave}
                disabled={
                  brandSaving ||
                  !brandCompanyName.trim() ||
                  !brandProducts.trim()
                }
                className={btnPrimary}
              >
                {brandSaving ? st.brand.saving : st.brand.save}
              </button>
            </div>
          )}

          {/* ── AI Brand Enrichment ─────────────────────────────── */}
          {brandLoaded && (() => {
            const ei = (st.brand as unknown as { aiEnrichment: Record<string, string> }).aiEnrichment;
            return (
            <div className="border-t border-slate-100 pt-6 mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-xl">auto_awesome</span>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    {ei.title}
                  </h3>
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-5">
                {ei.subtitle}
              </p>

              {/* State 1: Not started / CTA */}
              {enrichStep === "idle" && (
                <div className="text-center py-6">
                  {!hasBrand ? (
                    <p className="text-sm text-slate-400">
                      {ei.needsProfile}
                    </p>
                  ) : (
                    <button
                      onClick={async () => {
                        setEnrichStep("questions");
                        try {
                          const res = await fetch("/api/brand/enrich/questions", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ locale }),
                          });
                          const data = await res.json();
                          if (res.ok && data.questions?.length > 0) {
                            setEnrichQuestions(data.questions);
                            setEnrichAnswers({});
                            setEnrichCurrentQ(0);
                            setEnrichStep("answering");
                          } else {
                            showToast(data.error || "Failed", "error");
                            setEnrichStep("idle");
                          }
                        } catch {
                          showToast("Failed to load questions", "error");
                          setEnrichStep("idle");
                        }
                      }}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/20 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">auto_awesome</span>
                      {ei.start}
                    </button>
                  )}
                </div>
              )}

              {/* State 1b: Loading questions */}
              {enrichStep === "questions" && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 text-blue-500 animate-spin" />
                </div>
              )}

              {/* State 2: Answering questions — stepper */}
              {enrichStep === "answering" && enrichQuestions.length > 0 && (
                <div className="space-y-4">
                  {/* Progress bar */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[11px] font-bold text-slate-400 tabular-nums whitespace-nowrap">
                      {enrichCurrentQ + 1} / {enrichQuestions.length}
                    </span>
                    <div className="h-[3px] flex-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${((enrichCurrentQ + 1) / enrichQuestions.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Question card */}
                  <div className="bg-slate-50/80 rounded-xl p-5">
                    <p className="text-sm font-semibold text-slate-900 mb-3">
                      {enrichQuestions[enrichCurrentQ]?.question}
                    </p>
                    <textarea
                      className="w-full bg-white border border-slate-200 rounded-xl py-3 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none resize-none transition-colors"
                      rows={3}
                      value={enrichAnswers[enrichQuestions[enrichCurrentQ]?.id] ?? ""}
                      onChange={(e) => setEnrichAnswers(prev => ({ ...prev, [enrichQuestions[enrichCurrentQ].id]: e.target.value }))}
                      placeholder={enrichQuestions[enrichCurrentQ]?.placeholder}
                      autoFocus
                    />
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setEnrichCurrentQ(Math.max(0, enrichCurrentQ - 1))}
                      disabled={enrichCurrentQ === 0}
                      className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-30 cursor-pointer transition-colors"
                    >
                      {ei?.back}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (enrichCurrentQ < enrichQuestions.length - 1) {
                            setEnrichCurrentQ(enrichCurrentQ + 1);
                          }
                        }}
                        className="px-3 py-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                      >
                        {ei?.skip}
                      </button>
                      {enrichCurrentQ < enrichQuestions.length - 1 ? (
                        <button
                          onClick={() => setEnrichCurrentQ(enrichCurrentQ + 1)}
                          className="px-5 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                          {ei?.next}
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            setEnrichStep("generating");
                            try {
                              const answersArr = enrichQuestions.map(q => ({
                                questionId: q.id,
                                question: q.question,
                                answer: enrichAnswers[q.id] ?? "",
                              }));
                              const res = await fetch("/api/brand/enrich", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ answers: answersArr, locale }),
                              });
                              const data = await res.json();
                              if (res.ok && data.aiEnrichment) {
                                setAiEnrichmentData(data.aiEnrichment);
                                setEnrichStep("done");
                                showToast(ei?.enriched ?? "Enriched");
                              } else {
                                showToast(data.error || "Failed", "error");
                                setEnrichStep("answering");
                              }
                            } catch {
                              showToast("Enrichment failed", "error");
                              setEnrichStep("answering");
                            }
                          }}
                          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/20 hover:opacity-90 transition-all cursor-pointer"
                        >
                          {ei?.generate}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* State 2b: Generating enrichment */}
              {enrichStep === "generating" && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="size-6 text-blue-500 animate-spin" />
                  <p className="text-sm text-slate-400">{ei?.generating}</p>
                </div>
              )}

              {/* State 3: Enrichment complete — display fields */}
              {enrichStep === "done" && aiEnrichmentData && (() => {
                const en = ei;
                const d = aiEnrichmentData as Record<string, unknown>;

                const renderField = (label: string, key: string, multiline = false) => (
                  <div key={key}>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">{label}</label>
                    {multiline ? (
                      <textarea
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none transition-colors"
                        rows={3}
                        value={String(d[key] ?? "")}
                        onChange={(e) => setAiEnrichmentData(prev => prev ? { ...prev, [key]: e.target.value } : prev)}
                      />
                    ) : (
                      <input
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                        value={String(d[key] ?? "")}
                        onChange={(e) => setAiEnrichmentData(prev => prev ? { ...prev, [key]: e.target.value } : prev)}
                      />
                    )}
                  </div>
                );

                const renderList = (label: string, key: string) => {
                  const items = Array.isArray(d[key]) ? (d[key] as string[]) : [];
                  return (
                    <div key={key}>
                      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">{label}</label>
                      <div className="space-y-1.5">
                        {items.map((item, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                              value={item}
                              onChange={(e) => {
                                const updated = [...items];
                                updated[i] = e.target.value;
                                setAiEnrichmentData(prev => prev ? { ...prev, [key]: updated } : prev);
                              }}
                            />
                            <button
                              onClick={() => {
                                setAiEnrichmentData(prev => prev ? { ...prev, [key]: items.filter((_, j) => j !== i) } : prev);
                              }}
                              className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer shrink-0 px-1"
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            setAiEnrichmentData(prev => prev ? { ...prev, [key]: [...items, ""] } : prev);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                        >
                          + {en?.addPoint}
                        </button>
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="space-y-4">
                    {renderField(en?.description ?? "", "description", true)}
                    {renderField(en?.valueProposition ?? "", "valueProposition", true)}
                    {renderList(en?.messagingPoints ?? "", "messagingPoints")}
                    {renderList(en?.painPointsSolved ?? "", "painPointsSolved")}
                    {renderList(en?.competitiveAdvantages ?? "", "competitiveAdvantages")}
                    {renderField(en?.idealCustomerProfile ?? "", "idealCustomerProfile", true)}
                    {renderField(en?.pricingModel ?? "", "pricingModel")}
                    {renderField(en?.geographicFocus ?? "", "geographicFocus")}

                    {!!(d.generatedAt) && (
                      <p className="text-[11px] text-slate-400">
                        {en?.generatedAt}: {new Date(d.generatedAt as string).toLocaleDateString(locale === "da" ? "da-DK" : "en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={async () => {
                          setEnrichSaving(true);
                          try {
                            const res = await fetch("/api/brand", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ cvr: brandCvr || undefined, aiEnrichment: aiEnrichmentData }),
                            });
                            if (res.ok) showToast(locale === "da" ? "Gemt" : "Saved");
                            else showToast("Failed", "error");
                          } catch { showToast("Failed", "error"); }
                          finally { setEnrichSaving(false); }
                        }}
                        disabled={enrichSaving}
                        className={btnPrimary}
                      >
                        {enrichSaving ? (en?.savingEdits ?? "...") : (en?.saveEdits ?? "Save")}
                      </button>
                      <button
                        onClick={() => { setEnrichStep("idle"); setAiEnrichmentData(null); }}
                        className="px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
                      >
                        {en?.regenerate}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
            );
          })()}
        </div>}

        {/* ── Team / Organization ──────────────────────────────────────── */}
        {activeSection === "team" && <TeamSection />}


        {/* ── Notifications ────────────────────────────────────────────── */}
        {activeSection === "notifications" && <div className={cardClass}>
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-slate-400 text-xl">
              notifications
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {st.notifications.title}
            </h2>
          </div>

          <div className="space-y-5">
            {[
              {
                label: st.notifications.email,
                desc: st.notifications.emailDesc,
                checked: emailNotifs,
                onChange: setEmailNotifs,
              },
              {
                label: st.notifications.triggers,
                desc: st.notifications.triggersDesc,
                checked: triggerAlerts,
                onChange: setTriggerAlerts,
              },
              {
                label: st.notifications.weekly,
                desc: st.notifications.weeklyDesc,
                checked: weeklyReport,
                onChange: setWeeklyReport,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                </div>
                <Toggle checked={item.checked} onChange={item.onChange} />
              </div>
            ))}
          </div>
        </div>}

        {/* ── Language ─────────────────────────────────────────────────── */}
        {activeSection === "language" && <div className={cardClass}>
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-slate-400 text-xl">
              language
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {st.language.title}
            </h2>
          </div>

          <div className="space-y-1.5 max-w-xs">
            <label className={labelClass}>{st.language.label}</label>
            <div className="flex bg-slate-50 rounded-full p-1 gap-1">
              <button
                onClick={() => {
                  if (locale !== "da") {
                    toggleLocale();
                    setLanguageMutation.mutate("da");
                  }
                }}
                disabled={setLanguageMutation.isPending}
                className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
                  locale === "da"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {st.language.danish}
              </button>
              <button
                onClick={() => {
                  if (locale !== "en") {
                    toggleLocale();
                    setLanguageMutation.mutate("en");
                  }
                }}
                disabled={setLanguageMutation.isPending}
                className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
                  locale === "en"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {st.language.english}
              </button>
            </div>
          </div>

          {/* Email client preference */}
          <div className="space-y-1.5 max-w-xs mt-6">
            <label className={labelClass}>{st.language.emailClient}</label>
            <p className="text-xs text-slate-400 mb-2">{st.language.emailClientDesc}</p>
            <div className="flex bg-slate-50 rounded-full p-1 gap-1">
              {(["default", "gmail", "outlook"] as EmailClient[]).map((client) => (
                <button
                  key={client}
                  onClick={() => emailClient !== client && setEmailClientMutation.mutate(client)}
                  disabled={setEmailClientMutation.isPending}
                  className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
                    emailClient === client
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {client === "default"
                    ? st.language.emailDefault
                    : client === "gmail"
                      ? st.language.emailGmail
                      : st.language.emailOutlook}
                </button>
              ))}
            </div>
          </div>
        </div>}

        {/* ── CRM Integrations ─────────────────────────────────────────── */}
        {activeSection === "integrations" && <CrmIntegrationsSectionComponent />}

        {/* ── Subscription ─────────────────────────────────────────────── */}
        {activeSection === "subscription" && isOrgMember && (
          <div className={cardClass}>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                {locale === "da" ? "Betaling håndteres af organisationen" : "Covered by your organization"}
              </p>
              <p className="text-sm text-muted-foreground">
                {locale === "da"
                  ? `Dit abonnement styres af ${teamData?.org?.name}. Kontakt organisationens ejer for at ændre planer.`
                  : `Your subscription is managed by ${teamData?.org?.name}. Contact the org owner to change plans.`}
              </p>
            </div>
          </div>
        )}
        {activeSection === "subscription" && !isOrgMember && <SubscriptionSection />}

        {/* ── Videos ───────────────────────────────────────────────────── */}
        {activeSection === "videos" && isOwner && <div className={cardClass}>
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-slate-400 text-xl">
              movie
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Videos
            </h2>
          </div>
          <SettingsVideosSection />
        </div>}

        {/* ── Danger zone ──────────────────────────────────────────────── */}
        {activeSection === "danger" && <div className="bg-red-50/50 rounded-2xl border border-red-100 p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-red-500 text-xl">
              warning
            </span>
            <h2 className="text-sm font-bold text-red-700 uppercase tracking-wider">
              {st.danger.title}
            </h2>
          </div>
          <p className="text-sm text-red-600/70 mb-4">{st.danger.warning}</p>
          <button className="px-5 py-2.5 border-2 border-red-500 text-red-600 font-bold text-sm rounded-full hover:bg-red-500 hover:text-white transition-colors cursor-pointer">
            {st.danger.delete}
          </button>
        </div>}
        </div>
      </div>
      </DashboardLayout>
    </VideoTrigger>
  );
}
