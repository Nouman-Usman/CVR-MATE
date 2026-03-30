import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getOrgPlan, getPlanLimits, getUsageSummary } from "@/lib/stripe/entitlements";
import { PLANS } from "@/lib/stripe/plans";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.session.activeOrganizationId ?? "";

    const { plan, status, subscription } = await getOrgPlan(orgId);
    const limits = getPlanLimits(plan);
    const planDef = PLANS[plan];
    const usage = await getUsageSummary(orgId);

    const serializeInf = (v: number) => (isFinite(v) ? v : -1);

    return NextResponse.json({
      plan,
      planName: planDef.name,
      price: planDef.price,
      currency: planDef.currency,
      status,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      limits: {
        ...limits,
        savedCompanies: serializeInf(limits.savedCompanies),
        triggers: serializeInf(limits.triggers),
        aiUsagesPerMonth: serializeInf(limits.aiUsagesPerMonth),
        companySearchesPerMonth: serializeInf(limits.companySearchesPerMonth),
        exportsPerMonth: serializeInf(limits.exportsPerMonth),
      },
      usage,
    });
  } catch (error) {
    console.error("Failed to fetch subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
