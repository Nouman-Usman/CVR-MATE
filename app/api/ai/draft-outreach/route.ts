import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCompanyByVat, type CvrCompany } from "@/lib/cvr-api";
import { getUserBrand } from "@/lib/get-user-brand";
import { generateOutreach } from "@/lib/ai/draft-outreach";
import { checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";
import { db } from "@/db";
import { outreachMessage } from "@/db/schema";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      vat,
      type = "email",
      tone: requestTone,
      sellingPoint: requestSellingPoint,
      targetRole,
      locale = "en",
      companyData,
    } = await req.json();

    const draftFeature = type === "linkedin" ? "linkedin_draft" : type === "phone_script" ? "phone_draft" : "email_draft";

    const quota = await checkMonthlyQuota(session.user.id, draftFeature as "linkedin_draft" | "phone_draft" | "email_draft");
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `AI usage limit reached (${quota.used}/${quota.limit}). Upgrade for more.`, upgrade: true },
        { status: 403 }
      );
    }

    if (!vat || !/^\d{8}$/.test(String(vat))) {
      return NextResponse.json(
        { error: "Valid 8-digit CVR number is required" },
        { status: 400 }
      );
    }

    // Use brand data as defaults for sellingPoint and tone
    const brand = await getUserBrand(session.user.id);
    const sellingPoint = requestSellingPoint || brand?.products || "";
    const tone = requestTone || brand?.tone || "formal";

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

    const normalized = await generateOutreach({ company, type, tone, sellingPoint, targetRole, locale, brand });

    if (!normalized.message) {
      return NextResponse.json({ error: "AI returned empty message" }, { status: 500 });
    }

    // Persist to database
    const [saved] = await db
      .insert(outreachMessage)
      .values({
        userId: session.user.id,
        companyVat: String(vat),
        companyName: company.life.name,
        type,
        tone,
        subject: normalized.subject || null,
        message: normalized.message,
        followUp: normalized.followUp || "",
      })
      .returning();

    await recordUsage(session.user.id, draftFeature as "linkedin_draft" | "phone_draft" | "email_draft");
    return NextResponse.json({ ...normalized, id: saved.id });
  } catch (error) {
    console.error("AI outreach error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate outreach";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
