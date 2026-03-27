// Shared by server and client — no "server-only" import
// Price IDs come from env vars; set them in Stripe Dashboard → Products

export type PlanId = "free" | "go" | "flow";

export interface PlanLimits {
  savedCompanies: number;
  triggers: number;
  aiFeatures: boolean;
  crm: boolean;
  exports: boolean;
  teamFeatures: boolean;
  prioritySupport: boolean;
  // Monthly quotas (0 = disabled, Infinity = unlimited)
  aiUsagesPerMonth: number;
  companySearchesPerMonth: number;
  exportsPerMonth: number;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: number;
  currency: string;
  interval: "month";
  limits: PlanLimits;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    savedCompanies: 10,
    triggers: 0,
    aiFeatures: false,
    crm: false,
    exports: false,
    teamFeatures: false,
    prioritySupport: false,
    aiUsagesPerMonth: 0,
    companySearchesPerMonth: 20,
    exportsPerMonth: 0,
  },
  go: {
    savedCompanies: 100,
    triggers: 5,
    aiFeatures: true,
    crm: true,
    exports: true,
    teamFeatures: false,
    prioritySupport: false,
    aiUsagesPerMonth: 50,
    companySearchesPerMonth: 500,
    exportsPerMonth: 30,
  },
  flow: {
    savedCompanies: Infinity,
    triggers: Infinity,
    aiFeatures: true,
    crm: true,
    exports: true,
    teamFeatures: true,
    prioritySupport: true,
    aiUsagesPerMonth: Infinity,
    companySearchesPerMonth: Infinity,
    exportsPerMonth: Infinity,
  },
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    currency: "DKK",
    interval: "month",
    limits: PLAN_LIMITS.free,
  },
  go: {
    id: "go",
    name: "CVR-MATE GO",
    price: 2999,
    currency: "DKK",
    interval: "month",
    limits: PLAN_LIMITS.go,
  },
  flow: {
    id: "flow",
    name: "CVR-MATE FLOW",
    price: 4999,
    currency: "DKK",
    interval: "month",
    limits: PLAN_LIMITS.flow,
  },
};

/** Resolve a Stripe Price ID to our internal plan ID */
export function priceToPlan(stripePriceId: string | null | undefined): PlanId {
  if (!stripePriceId) return "free";
  const goPriceId = process.env.NEXT_PUBLIC_STRIPE_GO_PRICE_ID;
  const flowPriceId = process.env.NEXT_PUBLIC_STRIPE_FLOW_PRICE_ID;
  if (stripePriceId === goPriceId) return "go";
  if (stripePriceId === flowPriceId) return "flow";
  return "free";
}
