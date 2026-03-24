import { NextRequest, NextResponse } from "next/server";
import { searchCompanies } from "@/lib/cvr-api";
import { cacheGet, cacheSet } from "@/lib/redis";
import { cacheKey, CACHE_TTL } from "@/lib/cache";

export async function GET(req: NextRequest) {
  try {
    const days = Number(req.nextUrl.searchParams.get("days") || "7");
    const safeDays = Math.min(Math.max(days, 1), 7); // max 1 week

    // Check Redis cache first (24h TTL)
    const key = cacheKey.recent(safeDays);
    const cached = await cacheGet<{ results: unknown[]; count: number; from: string }>(key);
    if (cached) return NextResponse.json(cached);

    const fromDate = new Date(
      Date.now() - safeDays * 24 * 60 * 60 * 1000
    );
    const fromStr = fromDate.toISOString().split("T")[0];

    const results = await searchCompanies({
      life_start: fromStr,
      companystatus_code: "20",
    });

    const companies = Array.isArray(results) ? results : [];

    // Sort newest first
    companies.sort((a, b) => {
      const da = a.life?.start || "";
      const db = b.life?.start || "";
      return db.localeCompare(da);
    });

    // Deduplicate by VAT
    const seen = new Set<number>();
    const unique = companies.filter((c) => {
      if (seen.has(c.vat)) return false;
      seen.add(c.vat);
      return true;
    });

    const payload = {
      results: unique,
      count: unique.length,
      from: fromStr,
    };

    // Cache in Redis for 24 hours
    await cacheSet(key, payload, CACHE_TTL.recent);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("CVR recent error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch recent companies";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
