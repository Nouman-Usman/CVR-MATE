import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getUserPlan, getPlanLimits } from "@/lib/stripe/entitlements";
import { PLANS } from "@/lib/stripe/plans";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan, status, subscription } = await getUserPlan(session.user.id);
    const limits = getPlanLimits(plan);
    const planDef = PLANS[plan];

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
        // Serialize Infinity as -1 for JSON transport
        savedCompanies: limits.savedCompanies === Infinity ? -1 : limits.savedCompanies,
        triggers: limits.triggers === Infinity ? -1 : limits.triggers,
      },
    });
  } catch (error) {
    console.error("Failed to fetch subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
