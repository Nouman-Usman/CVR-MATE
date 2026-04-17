// Shared by server and client — no "server-only" import
// Price IDs come from env vars; set them in Stripe Dashboard → Products

// ─── Plan IDs ───────────────────────────────────────────────────────────────

export type PlanId = "free" | "starter" | "professional" | "enterprise";

/** Resolve a plan string to a valid PlanId (defaults to "free" for unknown values) */
export function resolvePlanId(plan: string): PlanId {
  if (plan === "free" || plan === "starter" || plan === "professional" || plan === "enterprise") {
    return plan;
  }
  // Legacy plan migration: users who still have old plan names in the DB
  if (plan === "go") return "professional";
  if (plan === "flow") return "enterprise";
  return "free";
}

// ─── Plan Limits ────────────────────────────────────────────────────────────

export interface PlanLimits {
  // Counted resources (lifetime per account)
  savedCompanies: number;
  triggers: number;
  followedPeople: number;
  tasks: number;
  crmConnections: number; // 0 = no CRM, 1 = one provider, 3 = all providers

  // Monthly quotas (0 = disabled, Infinity = unlimited)
  companySearchesPerMonth: number;
  aiUsagesPerMonth: number;
  enrichmentsPerMonth: number;
  emailDraftsPerMonth: number;
  linkedinDraftsPerMonth: number;
  phoneDraftsPerMonth: number;
  exportsPerMonth: number;
  aiTaskSuggestPerMonth: number;
  bulkPushPerMonth: number;

  // Team
  teamFeatures: boolean;
  teamMemberLimit: number; // 0 = no teams, -1 = unlimited

  // Boolean features
  brandPersonalization: boolean;
  calendarExport: boolean;
  contextMenus: boolean;
  prioritySupport: boolean;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    savedCompanies: 5,
    triggers: 1,
    followedPeople: 0,
    tasks: 5,
    crmConnections: 0,
    companySearchesPerMonth: 10,
    aiUsagesPerMonth: 5,
    enrichmentsPerMonth: 3,
    emailDraftsPerMonth: 3,
    linkedinDraftsPerMonth: 3,
    phoneDraftsPerMonth: 3,
    exportsPerMonth: 10,
    aiTaskSuggestPerMonth: 3,
    bulkPushPerMonth: 0,
    teamFeatures: false,
    teamMemberLimit: 0,
    brandPersonalization: false,
    calendarExport: true,
    contextMenus: true,
    prioritySupport: false,
  },
  starter: {
    savedCompanies: 25,
    triggers: 3,
    followedPeople: 0,
    tasks: 10,
    crmConnections: 0,
    companySearchesPerMonth: 50,
    aiUsagesPerMonth: 10,
    enrichmentsPerMonth: 10,
    emailDraftsPerMonth: 5,
    linkedinDraftsPerMonth: 5,
    phoneDraftsPerMonth: 5,
    exportsPerMonth: 15,
    aiTaskSuggestPerMonth: 20,
    bulkPushPerMonth: 0,
    teamFeatures: false,
    teamMemberLimit: 0,
    brandPersonalization: true,
    calendarExport: true,
    contextMenus: true,
    prioritySupport: false,
  },
  professional: {
    savedCompanies: 100,
    triggers: 5,
    followedPeople: 10,
    tasks: Infinity,
    crmConnections: 1,
    companySearchesPerMonth: 500,
    aiUsagesPerMonth: 50,
    enrichmentsPerMonth: 30,
    emailDraftsPerMonth: 30,
    linkedinDraftsPerMonth: 30,
    phoneDraftsPerMonth: 30,
    exportsPerMonth: 30,
    aiTaskSuggestPerMonth: Infinity,
    bulkPushPerMonth: 30,
    teamFeatures: false,
    teamMemberLimit: 0,
    brandPersonalization: true,
    calendarExport: true,
    contextMenus: true,
    prioritySupport: false,
  },
  enterprise: {
    savedCompanies: Infinity,
    triggers: Infinity,
    followedPeople: Infinity,
    tasks: Infinity,
    crmConnections: 3,
    companySearchesPerMonth: Infinity,
    aiUsagesPerMonth: Infinity,
    enrichmentsPerMonth: Infinity,
    emailDraftsPerMonth: Infinity,
    linkedinDraftsPerMonth: Infinity,
    phoneDraftsPerMonth: Infinity,
    exportsPerMonth: Infinity,
    aiTaskSuggestPerMonth: Infinity,
    bulkPushPerMonth: Infinity,
    teamFeatures: true,
    teamMemberLimit: -1, // unlimited
    brandPersonalization: true,
    calendarExport: true,
    contextMenus: true,
    prioritySupport: true,
  },
};

// ─── Plan Definitions ───────────────────────────────────────────────────────

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: number;
  annualPrice: number; // per month when billed annually (20% off)
  currency: string;
  limits: PlanLimits;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    annualPrice: 0,
    currency: "DKK",
    limits: PLAN_LIMITS.free,
  },
  starter: {
    id: "starter",
    name: "CVR-MATE Starter",
    price: 299,
    annualPrice: 239,
    currency: "DKK",
    limits: PLAN_LIMITS.starter,
  },
  professional: {
    id: "professional",
    name: "CVR-MATE Professional",
    price: 699,
    annualPrice: 559,
    currency: "DKK",
    limits: PLAN_LIMITS.professional,
  },
  enterprise: {
    id: "enterprise",
    name: "CVR-MATE Enterprise",
    price: 1699,
    annualPrice: 1359,
    currency: "DKK",
    limits: PLAN_LIMITS.enterprise,
  },
};

// ─── Stripe Price Resolution ────────────────────────────────────────────────

/** Resolve a Stripe Price ID to our internal plan ID */
export function priceToPlan(stripePriceId: string | null | undefined): PlanId {
  if (!stripePriceId) return "free";

  const priceMap: Record<string, PlanId> = {};

  const starterMonthly = process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID;
  const starterAnnual = process.env.NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID;
  const proMonthly = process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID;
  const proAnnual = process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID;
  const entMonthly = process.env.NEXT_PUBLIC_STRIPE_ENT_MONTHLY_PRICE_ID;
  const entAnnual = process.env.NEXT_PUBLIC_STRIPE_ENT_ANNUAL_PRICE_ID;

  if (starterMonthly) priceMap[starterMonthly] = "starter";
  if (starterAnnual) priceMap[starterAnnual] = "starter";
  if (proMonthly) priceMap[proMonthly] = "professional";
  if (proAnnual) priceMap[proAnnual] = "professional";
  if (entMonthly) priceMap[entMonthly] = "enterprise";
  if (entAnnual) priceMap[entAnnual] = "enterprise";

  return priceMap[stripePriceId] ?? "free";
}
