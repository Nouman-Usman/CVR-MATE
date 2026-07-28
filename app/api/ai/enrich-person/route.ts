import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getUserBrand } from "@/lib/get-user-brand";
import { generatePersonEnrichment } from "@/lib/ai/enrich-person";
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

    const { participantNumber, personName, locale = "en", personData, companies } = await req.json();

    if (!participantNumber) {
      return NextResponse.json({ error: "participantNumber is required" }, { status: 400 });
    }

    const brand = await getUserBrand(session.user.id);

    const enrichment = await generatePersonEnrichment({
      participantNumber,
      personName,
      personData,
      companies,
      locale,
      brand,
    });

    if (!enrichment.summary || enrichment.summary.length < 10) {
      return NextResponse.json({ error: "Person enrichment generation failed. Please try again." }, { status: 500 });
    }

    // Persist to Postgres
    const life = (personData?.life ?? {}) as Record<string, unknown>;
    const [saved] = await db
      .insert(profileEnrichment)
      .values({
        userId: session.user.id,
        entityType: "person",
        entityId: String(participantNumber),
        entityName: personName ?? String(life.name ?? "Unknown"),
        enrichmentData: enrichment,
      })
      .returning();

    // Cache in Redis (24h)
    const rKey = cacheKey.enrichment("person", String(participantNumber), session.user.id);
    await cacheSet(rKey, { ...enrichment, id: saved.id, createdAt: saved.createdAt.toISOString() }, CACHE_TTL.enrichment);

    await recordUsage(session.user.id, "enrichment");

    return NextResponse.json({
      enrichment: { ...enrichment, id: saved.id, createdAt: saved.createdAt.toISOString() },
    });
  } catch (error) {
    console.error("Person enrichment error:", error instanceof Error ? error.stack : error);
    const message = error instanceof Error ? error.message : "Failed to generate enrichment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
