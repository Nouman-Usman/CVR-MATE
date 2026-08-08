import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getUserBrand } from "@/lib/get-user-brand";
import { analyzePipeline } from "@/lib/ai/analyze-pipeline";
import { checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";
import { resolveWorkspaceForUser } from "@/lib/workspace/resolve";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quota = await checkMonthlyQuota(session.user.id, "ai_usage", await resolveWorkspaceForUser(session.user.id, session.session?.activeOrganizationId));
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `AI usage limit reached (${quota.used}/${quota.limit}). Upgrade for more.`, upgrade: true },
        { status: 403 }
      );
    }

    const { companyVats, locale = "en" } = await req.json();

    if (!Array.isArray(companyVats) || companyVats.length === 0) {
      return NextResponse.json(
        { error: "companyVats array is required" },
        { status: 400 }
      );
    }

    if (companyVats.length > 25) {
      return NextResponse.json(
        { error: "Maximum 25 companies can be analyzed at once" },
        { status: 400 }
      );
    }

    const brand = await getUserBrand(session.user.id);

    const outcome = await analyzePipeline({ vats: companyVats, locale, brand });
    if (!outcome.ok) {
      return NextResponse.json({ error: "No valid companies found" }, { status: 404 });
    }

    await recordUsage(session.user.id, "ai_usage", await resolveWorkspaceForUser(session.user.id, session.session?.activeOrganizationId));
    return NextResponse.json(outcome.result);
  } catch (error) {
    console.error("AI pipeline analysis error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to analyze pipeline";
    const status = message.includes("rate limit") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
