import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCompanyByVat, type CvrCompany } from "@/lib/cvr-api";
import { getUserBrand } from "@/lib/get-user-brand";
import { generateCompanyEnrichment } from "@/lib/ai/enrich-company";
import { checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";
import { db } from "@/db";
import { profileEnrichment } from "@/db/schema";
import { cacheSet } from "@/lib/redis";
import { cacheKey, CACHE_TTL } from "@/lib/cache";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quota = await checkMonthlyQuota(session.user.id, "enrichment");
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

    let company: CvrCompany;
    try {
      company = await getCompanyByVat(Number(vat));
    } catch {
      if (companyData) {
        company = companyData as CvrCompany;
      } else {
        throw new Error("Could not fetch company data");
      }
    }

    const brand = await getUserBrand(session.user.id);

    const enrichment = await generateCompanyEnrichment({ company, locale, brand });

    // Validate minimum enrichment quality
    if (!enrichment.summary || enrichment.summary.length < 20) {
      return NextResponse.json(
        { error: "AI enrichment generation failed. Please try again in a moment." },
        { status: 500 }
      );
    }

    // Persist to Postgres
    const [saved] = await db
      .insert(profileEnrichment)
      .values({
        userId: session.user.id,
        entityType: "company",
        entityId: String(vat),
        entityName: company.life.name,
        enrichmentData: enrichment,
      })
      .returning();

    // Cache in Redis (24h)
    const rKey = cacheKey.enrichment("company", String(vat), session.user.id);
    await cacheSet(rKey, { ...enrichment, id: saved.id, createdAt: saved.createdAt.toISOString() }, CACHE_TTL.enrichment);

    await recordUsage(session.user.id, "enrichment");

    return NextResponse.json({
      enrichment: { ...enrichment, id: saved.id, createdAt: saved.createdAt.toISOString() },
    });
  } catch (error) {
    const isRateLimit = error instanceof Error && (error.message.includes("rate limit") || error.message.includes("quota"));
    const status = isRateLimit ? 429 : 500;
    const message = error instanceof Error ? error.message : "Failed to generate enrichment";

    console.error(`[Enrichment Error] Status ${status}:`, message);
    if (error instanceof Error && error.stack) {
      console.error("[Stack]", error.stack.split("\n").slice(0, 5).join("\n"));
    }

    return NextResponse.json(
      {
        error: message,
        ...(isRateLimit && { retryAfter: 60 }),
      },
      { status }
    );
  }
}
