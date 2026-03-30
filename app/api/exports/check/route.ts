import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { checkEntitlement, checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";

/**
 * POST /api/exports/check
 * Frontend calls this before generating a CSV/PDF export.
 * Checks the exports entitlement + monthly quota, and records the usage if allowed.
 */
export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.session.activeOrganizationId ?? "";

    const { allowed: featureAllowed } = await checkEntitlement(orgId, "exports");
    if (!featureAllowed) {
      return NextResponse.json(
        { error: "Exports require a paid plan", upgrade: true },
        { status: 403 }
      );
    }

    const quota = await checkMonthlyQuota(orgId, "export");
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `Export limit reached (${quota.used}/${quota.limit}). Upgrade for more.`, upgrade: true },
        { status: 403 }
      );
    }

    await recordUsage(orgId, session.user.id, "export");

    return NextResponse.json({
      allowed: true,
      used: quota.used + 1,
      limit: quota.limit,
    });
  } catch (error) {
    console.error("Export check error:", error);
    const message = error instanceof Error ? error.message : "Failed to check export quota";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
