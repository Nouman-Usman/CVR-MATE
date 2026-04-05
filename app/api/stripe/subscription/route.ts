import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getUserPlan, getPlanLimits, getUsageSummary } from "@/lib/stripe/entitlements";
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
    const usage = await getUsageSummary(session.user.id);

    const serializeInf = (v: number) => (isFinite(v) ? v : -1);

    // Serialize all numeric limits (Infinity → -1 for JSON)
    const serializedLimits: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(limits)) {
      serializedLimits[key] = typeof value === "number" && !isFinite(value) ? -1 : value;
    }

    return NextResponse.json({
      plan,
      planName: planDef.name,
      price: planDef.price,
      annualPrice: planDef.annualPrice,
      currency: planDef.currency,
      status,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      limits: serializedLimits,
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
