import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCompanyByVat, type CvrCompany } from "@/lib/cvr-api";
import { getUserBrand } from "@/lib/get-user-brand";
import { generateTodoSuggestions } from "@/lib/ai/suggest-todos";
import { checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quota = await checkMonthlyQuota(session.user.id, "ai_task_suggest");
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

    // Fetch company data — use client-provided data as fallback
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

    const result = await generateTodoSuggestions({ company, locale, brand });

    await recordUsage(session.user.id, "ai_task_suggest");
    return NextResponse.json(result);
  } catch (error) {
    console.error("AI suggest-todos error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to suggest tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
