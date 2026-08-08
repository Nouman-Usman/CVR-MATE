import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCompanyByVat, type CvrCompany } from "@/lib/cvr-api";
import { getUserBrand } from "@/lib/get-user-brand";
import { generateCompanyBriefing } from "@/lib/ai/company-briefing";
import { checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";
import { resolveWorkspaceForUser } from "@/lib/workspace/resolve";
import { db } from "@/db";
import { companyBriefing } from "@/db/schema";

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

    const { vat, locale = "en", companyData } = await req.json();

    if (!vat || !/^\d{8}$/.test(String(vat))) {
      return NextResponse.json(
        { error: "Valid 8-digit CVR number is required" },
        { status: 400 }
      );
    }

    // Fetch company data and user brand — use client-provided data as fallback
    let company: CvrCompany;
    try {
      company = await getCompanyByVat(Number(vat));
    } catch (err) {
      if (companyData) {
        company = companyData as CvrCompany;
      } else {
        throw err;
      }
    }
    const brand = await getUserBrand(session.user.id);

    const result = await generateCompanyBriefing({ company, locale, brand });

    if (!result.briefing || result.briefing.includes("generation") || result.briefing.length < 20) {
      return NextResponse.json({ error: "Briefing generation failed. Please try again in a moment." }, { status: 500 });
    }

    // Persist to database
    const [saved] = await db
      .insert(companyBriefing)
      .values({
        userId: session.user.id,
        companyVat: String(vat),
        companyName: company.life.name,
        briefing: result.briefing,
        keyInsights: result.keyInsights,
        suggestedApproach: result.suggestedApproach || "",
      })
      .returning();

    await recordUsage(session.user.id, "ai_usage", await resolveWorkspaceForUser(session.user.id, session.session?.activeOrganizationId));
    return NextResponse.json({ ...result, id: saved.id });
  } catch (error) {
    console.error("AI briefing error:", error instanceof Error ? error.stack : error);
    const message =
      error instanceof Error ? error.message : "Failed to generate briefing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
