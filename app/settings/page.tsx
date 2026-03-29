"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { authClient } from "@/lib/auth-client";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import Link from "next/link";
import { useIntegrations, useCrmDisconnect, useSyncHistory } from "@/lib/hooks/use-integrations";
import {
  useSubscription,
  useCheckout,
  useCustomerPortal,
  useCancelSubscription,
  useResumeSubscription,
  useChangePlan,
} from "@/lib/hooks/use-subscription";
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

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrgMember {
  id: string;
  role: string;
  createdAt: string;
  userId: string;
  user: { id: string; name: string; email: string; image?: string | null };
}

interface OrgInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface Org {
  id: string;
  name: string;
  slug: string;
  members?: OrgMember[];
  invitations?: OrgInvitation[];
}

// ─── Subscription Section ─────────────────────────────────────────────────────

const PLAN_COLORS = {
  free: { bg: "bg-slate-100", text: "text-slate-700" },
  go: { bg: "bg-blue-50", text: "text-blue-700" },
  flow: { bg: "bg-violet-50", text: "text-violet-700" },
} as const;

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
  const checkoutMutation = useCheckout();
  const portalMutation = useCustomerPortal();
  const cancelMutation = useCancelSubscription();
  const resumeMutation = useResumeSubscription();
  const changePlanMutation = useChangePlan();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const cardClass =
    "bg-white rounded-2xl shadow-sm border border-slate-100/60 p-4 sm:p-6 md:p-8";

  const goPriceId = process.env.NEXT_PUBLIC_STRIPE_GO_PRICE_ID;
  const flowPriceId = process.env.NEXT_PUBLIC_STRIPE_FLOW_PRICE_ID;

  const plan = data?.plan ?? "free";
  const planColor = PLAN_COLORS[plan];
  const planNames = {
    free: (sub.free as { name: string })?.name ?? "Free",
    go: (sub.go as { name: string })?.name ?? "CVR-MATE GO",
    flow: (sub.flow as { name: string })?.name ?? "CVR-MATE FLOW",
  };
  const planDescriptions = {
    free: (sub.free as { description: string })?.description ?? "",
    go: (sub.go as { description: string })?.description ?? "",
    flow: (sub.flow as { description: string })?.description ?? "",
  };

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
    checkoutMutation.isPending || portalMutation.isPending ||
    cancelMutation.isPending || resumeMutation.isPending || changePlanMutation.isPending;

  return (
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

          {/* Cancel notice with resume button */}
          {isCanceling && !isPastDue && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-500 text-lg mt-0.5 shrink-0">schedule</span>
              <div className="flex-1">
                <p className="text-sm text-amber-700">{sub.cancelNotice as string}</p>
                <button
                  onClick={() => resumeMutation.mutate()}
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
          <div className="bg-slate-50 rounded-xl p-6 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className={`px-3 py-1 ${planColor.bg} ${planColor.text} rounded-full text-xs font-bold uppercase tracking-wider`}>
                    {planNames[plan]}
                  </span>
                  {isPaid && data?.price != null && (
                    <span className="text-lg font-black text-slate-900">
                      {data.price.toLocaleString(locale === "da" ? "da-DK" : "en-US")} {data.currency}{sub.perMonth as string}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1">{planDescriptions[plan]}</p>
                {nextBillingDate && isPaid && !isCanceling && (
                  <p className="text-xs text-slate-400 mt-2">
                    {sub.nextBilling as string}: {nextBillingDate}
                  </p>
                )}
              </div>

              <div className="flex gap-2 self-start shrink-0">
                {isPaid && (
                  <>
                    <button
                      onClick={() => portalMutation.mutate()}
                      disabled={anyMutationPending}
                      className="px-4 py-2 border-2 border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
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
                        className="px-4 py-2 border-2 border-red-200 rounded-full text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {sub.cancelSubscription as string}
                      </button>
                    )}
                  </>
                )}
                {!isPaid && (
                  <p className="text-sm text-slate-400">{sub.freePlan as string}</p>
                )}
              </div>
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
                      onSuccess: () => setShowCancelConfirm(false),
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
                  label={sub.companySearches as string}
                  used={data.usage.companySearches.used}
                  limit={data.usage.companySearches.limit}
                />
                <UsageMeter
                  label={sub.aiUsages as string}
                  used={data.usage.aiUsages.used}
                  limit={data.usage.aiUsages.limit}
                />
                <UsageMeter
                  label={sub.exports as string}
                  used={data.usage.exports.used}
                  limit={data.usage.exports.limit}
                />
              </div>
            </div>
          )}

          {/* Plan change options */}
          {plan !== "flow" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plan === "free" && goPriceId && (
                <button
                  onClick={() => changePlanMutation.mutate("go")}
                  disabled={anyMutationPending}
                  className="flex items-center justify-between p-4 rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer disabled:opacity-50"
                >
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">{planNames.go}</p>
                    <p className="text-xs text-slate-500">{planDescriptions.go}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-blue-600">2.999 DKK{sub.perMonth as string}</span>
                    <span className="material-symbols-outlined text-blue-600 text-lg">arrow_forward</span>
                  </div>
                </button>
              )}
              {flowPriceId && (
                <button
                  onClick={() => changePlanMutation.mutate("flow")}
                  disabled={anyMutationPending}
                  className="flex items-center justify-between p-4 rounded-xl border-2 border-violet-200 hover:border-violet-400 hover:bg-violet-50/50 transition-all cursor-pointer disabled:opacity-50"
                >
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900">{planNames.flow}</p>
                    <p className="text-xs text-slate-500">{planDescriptions.flow}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-violet-600">4.999 DKK{sub.perMonth as string}</span>
                    <span className="material-symbols-outlined text-violet-600 text-lg">arrow_forward</span>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Downgrade option for paid users */}
          {plan === "go" && (
            <div className="mt-3">
              <button
                onClick={() => changePlanMutation.mutate("free")}
                disabled={anyMutationPending}
                className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer disabled:opacity-50"
              >
                {sub.downgrade as string} → {planNames.free}
              </button>
            </div>
          )}
          {plan === "flow" && (
            <div className="mt-3 flex gap-4">
              <button
                onClick={() => changePlanMutation.mutate("go")}
                disabled={anyMutationPending}
                className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer disabled:opacity-50"
              >
                {sub.downgrade as string} → {planNames.go}
              </button>
              <button
                onClick={() => changePlanMutation.mutate("free")}
                disabled={anyMutationPending}
                className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer disabled:opacity-50"
              >
                {sub.downgrade as string} → {planNames.free}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── CRM Integrations Section ────────────────────────────────────────────────

const CRM_CARDS: { provider: "hubspot" | "salesforce" | "pipedrive"; name: string; color: string; icon: string; desc: string }[] = [
  { provider: "hubspot", name: "HubSpot", color: "#FF7A59", icon: "hub", desc: "Sync companies to HubSpot CRM" },
  { provider: "salesforce", name: "Salesforce", color: "#00A1E0", icon: "cloud", desc: "Push leads to Salesforce Accounts" },
  { provider: "pipedrive", name: "Pipedrive", color: "#017737", icon: "filter_alt", desc: "Send companies to Pipedrive" },
];

function CrmIntegrationsSection() {
  const { t } = useLanguage();
  const ig = t.integrations;
  const { data: intData, isLoading: intLoading } = useIntegrations();
  const disconnectMutation = useCrmDisconnect();
  const { data: historyData } = useSyncHistory();
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);

  const connections = intData?.connections ?? [];
  const connMap = new Map(connections.filter(c => c.isActive).map(c => [c.provider, c]));

  const handleConnect = (provider: string) => {
    window.location.href = `/api/integrations/${provider}/connect`;
  };

  const handleDisconnect = (provider: string) => {
    disconnectMutation.mutate(provider, {
      onSuccess: () => setConfirmDisconnect(null),
    });
  };

  const logs = historyData?.logs ?? [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-4 sm:p-6 md:p-8">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-slate-400 text-xl">sync</span>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          {ig.title}
        </h2>
      </div>
      <p className="text-sm text-slate-400 mb-6">{ig.subtitle}</p>

      {/* CRM Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {CRM_CARDS.map((crm) => {
          const conn = connMap.get(crm.provider);
          const isConnected = !!conn;

          return (
            <div
              key={crm.provider}
              className={`relative rounded-xl border-2 p-5 transition-all ${
                isConnected
                  ? "border-emerald-200 bg-emerald-50/30"
                  : "border-slate-100 bg-slate-50/30 hover:border-slate-200"
              }`}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: crm.color + "18" }}
                >
                  <span
                    className="material-symbols-outlined text-xl"
                    style={{ color: crm.color }}
                  >
                    {crm.icon}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{crm.name}</p>
                  <p className="text-[11px] text-slate-400">{crm.desc}</p>
                </div>
              </div>

              {isConnected ? (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="material-symbols-outlined text-emerald-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <span className="text-xs font-semibold text-emerald-700">{ig.connected}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-3">
                    {ig.connectedSince}{" "}
                    {new Date(conn.connectedAt).toLocaleDateString()}
                  </p>

                  {confirmDisconnect === crm.provider ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">{ig.confirmDisconnect}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDisconnect(crm.provider)}
                          disabled={disconnectMutation.isPending}
                          className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {ig.disconnect}
                        </button>
                        <button
                          onClick={() => setConfirmDisconnect(null)}
                          className="px-3 py-1.5 border border-slate-200 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDisconnect(crm.provider)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                    >
                      {ig.disconnect}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleConnect(crm.provider)}
                  disabled={intLoading}
                  className="w-full px-4 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: crm.color }}
                >
                  {ig.connect} {crm.name}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Sync History */}
      {logs.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            {ig.syncHistory}
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {logs.slice(0, 8).map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 text-xs py-2 border-b border-slate-50 last:border-0"
              >
                <span
                  className={`material-symbols-outlined text-sm ${
                    log.status === "success"
                      ? "text-emerald-500"
                      : "text-red-500"
                  }`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {log.status === "success" ? "check_circle" : "error"}
                </span>
                <span className="font-medium text-slate-600 capitalize">
                  {log.connection.provider}
                </span>
                <span className="text-slate-400">{log.action.replace(/_/g, " ")}</span>
                <span className="ml-auto text-slate-400">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t, locale, toggleLocale } = useLanguage();
  const { data: session } = useSession();
  const st = t.settings;

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

  // Team / Organization
  const [org, setOrg] = useState<Org | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteSending, setInviteSending] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [orgCreating, setOrgCreating] = useState(false);

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

  // ── Load organization data ──────────────────────────────────────────────

  const loadOrg = useCallback(async () => {
    setOrgLoading(true);
    try {
      // List user's organizations via better-auth REST API
      const orgsRes = await fetch("/api/auth/organization/list", {
        method: "GET",
        credentials: "include",
      });
      if (!orgsRes.ok) { setOrg(null); setOrgLoading(false); return; }
      const orgs = await orgsRes.json();
      if (Array.isArray(orgs) && orgs.length > 0) {
        // Set active org and get full details
        const fullRes = await fetch(
          `/api/auth/organization/get-full-organization?organizationId=${orgs[0].id}`,
          { method: "GET", credentials: "include" }
        );
        if (fullRes.ok) {
          const fullOrg = await fullRes.json();
          setOrg(fullOrg);
        }
      } else {
        setOrg(null);
      }
    } catch {
      setOrg(null);
    } finally {
      setOrgLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrg();
  }, [loadOrg]);

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

  // ── Org create ──────────────────────────────────────────────────────────

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setOrgCreating(true);
    try {
      const slug = newOrgName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const res = await fetch("/api/auth/organization/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newOrgName.trim(),
          slug: slug || `org-${Date.now()}`,
        }),
      });
      if (res.ok) {
        showToast(st.team.created);
        setNewOrgName("");
        await loadOrg();
      } else {
        showToast(locale === "da" ? "Kunne ikke oprette" : "Failed to create", "error");
      }
    } catch {
      showToast(
        locale === "da" ? "Kunne ikke oprette" : "Failed to create",
        "error"
      );
    } finally {
      setOrgCreating(false);
    }
  };

  // ── Invite member ───────────────────────────────────────────────────────

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !org) return;
    setInviteSending(true);
    try {
      const res = await fetch("/api/auth/organization/invite-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          organizationId: org.id,
        }),
      });
      if (res.ok) {
        showToast(st.team.sent);
        setInviteEmail("");
        await loadOrg();
      } else {
        showToast(st.team.inviteError, "error");
      }
    } catch {
      showToast(st.team.inviteError, "error");
    } finally {
      setInviteSending(false);
    }
  };

  // ── Remove member ───────────────────────────────────────────────────────

  const handleRemoveMember = async (memberIdOrEmail: string) => {
    if (!org) return;
    if (!window.confirm(st.team.removeConfirm)) return;
    try {
      const res = await fetch("/api/auth/organization/remove-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          memberIdOrEmail,
          organizationId: org.id,
        }),
      });
      if (res.ok) {
        showToast(st.team.removed);
        await loadOrg();
      }
    } catch {
      showToast(
        locale === "da" ? "Kunne ikke fjerne" : "Failed to remove",
        "error"
      );
    }
  };

  // ── Cancel invitation ───────────────────────────────────────────────────

  const handleCancelInvite = async (invitationId: string) => {
    if (!window.confirm(st.team.cancelConfirm)) return;
    try {
      const res = await fetch("/api/auth/organization/cancel-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ invitationId }),
      });
      if (res.ok) {
        showToast(st.team.cancelled);
        await loadOrg();
      }
    } catch {
      showToast(
        locale === "da" ? "Kunne ikke annullere" : "Failed to cancel",
        "error"
      );
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["account", "workspace", "billing"]));

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

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
        { key: "subscription", label: (st.subscription as { title: string }).title, icon: CreditCard },
        { key: "danger", label: st.danger.title, icon: AlertTriangle },
      ],
    },
  ];

  return (
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
        </div>}

        {/* ── Team / Organization ──────────────────────────────────────── */}
        {activeSection === "team" && <div className={cardClass}>
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-slate-400 text-xl">
              groups
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {st.team.title}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mb-6">{st.team.subtitle}</p>

          {orgLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-2xl text-slate-300">
                progress_activity
              </span>
            </div>
          ) : !org ? (
            /* No org — create one */
            <div className="bg-slate-50 rounded-xl p-6">
              <div className="flex items-start gap-3 mb-5">
                <span className="material-symbols-outlined text-blue-500 text-2xl shrink-0">
                  group_add
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {st.team.createOrg}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {st.team.createOrgDesc}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  className={`flex-1 ${inputClass}`}
                  placeholder={st.team.orgNamePlaceholder}
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
                <button
                  onClick={handleCreateOrg}
                  disabled={orgCreating || !newOrgName.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-lg hover:scale-[1.02] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center gap-2"
                >
                  {orgCreating ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">
                        progress_activity
                      </span>
                      {st.team.creating}
                    </>
                  ) : (
                    st.team.create
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Has org — show members + invite */
            <div className="space-y-6">
              {/* Invite form */}
              <div className="bg-slate-50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-blue-500 text-lg">
                    person_add
                  </span>
                  <p className="text-sm font-semibold text-slate-900">
                    {st.team.invite}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <span className="material-symbols-outlined text-lg">
                        mail
                      </span>
                    </div>
                    <input
                      className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      type="email"
                      placeholder={st.team.emailPlaceholder}
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <select
                    className="bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-900 outline-none appearance-none sm:w-32"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="member">{st.team.member}</option>
                    <option value="admin">{st.team.admin}</option>
                  </select>
                  <button
                    onClick={handleInvite}
                    disabled={inviteSending || !inviteEmail.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-lg hover:scale-[1.02] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center gap-2"
                  >
                    {inviteSending ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-sm">
                          progress_activity
                        </span>
                        {st.team.sending}
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">
                          send
                        </span>
                        {st.team.send}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Members list */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
                  {st.team.members}
                </h3>
                {org.members && org.members.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {org.members.map((m) => {
                      const mInitials = (m.user.name || m.user.email)
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();
                      const isCurrentUser = m.userId === session?.user?.id;
                      const roleLabel =
                        m.role === "owner"
                          ? st.team.owner
                          : m.role === "admin"
                            ? st.team.admin
                            : st.team.member;
                      return (
                        <div
                          key={m.id}
                          className="flex items-center gap-3 py-3"
                        >
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {mInitials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {m.user.name || m.user.email}
                              {isCurrentUser && (
                                <span className="text-xs text-slate-400 ml-1.5 font-normal">
                                  ({locale === "da" ? "dig" : "you"})
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {m.user.email}
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                              m.role === "owner"
                                ? "bg-amber-50 text-amber-700"
                                : m.role === "admin"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {roleLabel}
                          </span>
                          {!isCurrentUser && m.role !== "owner" && (
                            <button
                              onClick={() => handleRemoveMember(m.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors p-1 cursor-pointer shrink-0"
                              title={st.team.remove}
                            >
                              <span className="material-symbols-outlined text-lg">
                                close
                              </span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 py-3">
                    {st.team.noMembers}
                  </p>
                )}
              </div>

              {/* Pending invitations */}
              {org.invitations &&
                org.invitations.filter((i) => i.status === "pending").length >
                  0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
                      {st.team.pendingInvites}
                    </h3>
                    <div className="divide-y divide-slate-100">
                      {org.invitations
                        .filter((i) => i.status === "pending")
                        .map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center gap-3 py-3"
                          >
                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                              <span className="material-symbols-outlined text-lg">
                                mail
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">
                                {inv.email}
                              </p>
                              <p className="text-xs text-slate-400">
                                {inv.role === "admin"
                                  ? st.team.admin
                                  : st.team.member}
                              </p>
                            </div>
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                              {locale === "da" ? "Ventende" : "Pending"}
                            </span>
                            <button
                              onClick={() => handleCancelInvite(inv.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors p-1 cursor-pointer shrink-0"
                              title={st.team.cancel}
                            >
                              <span className="material-symbols-outlined text-lg">
                                close
                              </span>
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>}

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
                onClick={() => locale !== "da" && toggleLocale()}
                className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
                  locale === "da"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {st.language.danish}
              </button>
              <button
                onClick={() => locale !== "en" && toggleLocale()}
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
        </div>}

        {/* ── CRM Integrations ─────────────────────────────────────────── */}
        {activeSection === "integrations" && <CrmIntegrationsSection />}

        {/* ── Subscription ─────────────────────────────────────────────── */}
        {activeSection === "subscription" && <SubscriptionSection />}

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
  );
}
