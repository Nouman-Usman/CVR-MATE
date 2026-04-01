import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { profileEnrichment } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cacheGet, cacheSet } from "@/lib/redis";
import { cacheKey, CACHE_TTL } from "@/lib/cache";

// GET /api/ai/enrichment?type=company&id=28866984
// Redis-first, Postgres fallback
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const type = req.nextUrl.searchParams.get("type");
    const id = req.nextUrl.searchParams.get("id");

    if (!type || !id || !["company", "person"].includes(type)) {
      return NextResponse.json(
        { error: "type (company|person) and id are required" },
        { status: 400 }
      );
    }

    // Try Redis cache first
    const rKey = cacheKey.enrichment(type, id, session.user.id);
    const cached = await cacheGet<Record<string, unknown>>(rKey);
    if (cached) {
      return NextResponse.json({ enrichment: cached });
    }

    // Fall back to Postgres — get the most recent enrichment
    const rows = await db
      .select()
      .from(profileEnrichment)
      .where(
        and(
          eq(profileEnrichment.userId, session.user.id),
          eq(profileEnrichment.entityType, type),
          eq(profileEnrichment.entityId, id)
        )
      )
      .orderBy(desc(profileEnrichment.createdAt))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ enrichment: null });
    }

    const row = rows[0];
    const data = {
      ...(row.enrichmentData as Record<string, unknown>),
      id: row.id,
      createdAt: row.createdAt.toISOString(),
    };

    // Warm Redis cache (24h)
    await cacheSet(rKey, data, CACHE_TTL.enrichment);

    return NextResponse.json({ enrichment: data });
  } catch (error) {
    console.error("Failed to fetch enrichment:", error);
    return NextResponse.json(
      { error: "Failed to fetch enrichment" },
      { status: 500 }
    );
  }
}
