// Shared by server and client — no "server-only" import
// Price IDs come from env vars; set them in Stripe Dashboard → Products

export type PlanId = "free" | "go" | "flow" | "enterprise";

export interface PlanLimits {
  savedCompanies: number;
  triggers: number;
  aiFeatures: boolean;
  crm: boolean;
  exports: boolean;
  teamFeatures: boolean;
  prioritySupport: boolean;
  // Enterprise features
  sso: boolean;
  apiAccess: boolean;
  auditLog: boolean;
  customBranding: boolean;
  dataGovernance: boolean;
  ipAllowlist: boolean;
  maxSeats: number; // 1 = solo, Infinity = unlimited
  // Monthly quotas (0 = disabled, Infinity = unlimited)
  aiUsagesPerMonth: number;
  companySearchesPerMonth: number;
  exportsPerMonth: number;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: number; // base price (0 for enterprise = custom pricing)
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
    sso: false,
    apiAccess: false,
    auditLog: false,
    customBranding: false,
    dataGovernance: false,
    ipAllowlist: false,
    maxSeats: 1,
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
    sso: false,
    apiAccess: false,
    auditLog: false,
    customBranding: false,
    dataGovernance: false,
    ipAllowlist: false,
    maxSeats: 3,
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
    sso: false,
    apiAccess: true,
    auditLog: true,
    customBranding: false,
    dataGovernance: false,
    ipAllowlist: false,
    maxSeats: 10,
    aiUsagesPerMonth: Infinity,
    companySearchesPerMonth: Infinity,
    exportsPerMonth: Infinity,
  },
  enterprise: {
    savedCompanies: Infinity,
    triggers: Infinity,
    aiFeatures: true,
    crm: true,
    exports: true,
    teamFeatures: true,
    prioritySupport: true,
    sso: true,
    apiAccess: true,
    auditLog: true,
    customBranding: true,
    dataGovernance: true,
    ipAllowlist: true,
    maxSeats: Infinity,
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
  enterprise: {
    id: "enterprise",
    name: "CVR-MATE Enterprise",
    price: 0, // custom pricing — contact sales
    currency: "DKK",
    interval: "month",
    limits: PLAN_LIMITS.enterprise,
  },
};

/** Resolve a Stripe Price ID to our internal plan ID */
export function priceToPlan(stripePriceId: string | null | undefined): PlanId {
  if (!stripePriceId) return "free";
  const goPriceId = process.env.NEXT_PUBLIC_STRIPE_GO_PRICE_ID;
  const flowPriceId = process.env.NEXT_PUBLIC_STRIPE_FLOW_PRICE_ID;
  const enterprisePriceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID;
  if (stripePriceId === goPriceId) return "go";
  if (stripePriceId === flowPriceId) return "flow";
  if (stripePriceId === enterprisePriceId) return "enterprise";
  return "free";
}
