import { NextRequest, NextResponse } from "next/server";
import { searchCompanies } from "@/lib/cvr-api";
import { cacheGet, cacheSet } from "@/lib/redis";
import { cacheKey, CACHE_TTL } from "@/lib/cache";

export async function GET(req: NextRequest) {
  try {
    const days = Number(req.nextUrl.searchParams.get("days") || "7");
    const safeDays = Math.min(Math.max(days, 1), 7); // max 1 week

    const force = req.nextUrl.searchParams.get("force") === "1";

    // Check Redis cache first (skip if force refresh)
    const key = cacheKey.recent(safeDays);
    if (!force) {
      const cached = await cacheGet<{ results: unknown[]; count: number; from: string }>(key);
      if (cached) return NextResponse.json(cached);
    }

    // Query each day individually — life_start is an exact-date filter,
    // so a single call only returns companies founded on that one day.
    const dates: string[] = [];
    for (let i = 0; i < safeDays; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dates.push(d.toISOString().split("T")[0]);
    }
    const fromStr = dates[dates.length - 1];

    // Fetch ALL companies per day by paginating through results
    const PAGE_LIMIT = 100;

    async function fetchAllForDate(date: string) {
      const all: Awaited<ReturnType<typeof searchCompanies>> = [];
      let page = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const batch = await searchCompanies({
          life_start: date,
          companystatus_code: "20",
          limit: String(PAGE_LIMIT),
          page: String(page),
        }).catch(() => [] as Awaited<ReturnType<typeof searchCompanies>>);
        all.push(...batch);
        // If we got fewer than the limit, we've reached the last page
        if (batch.length < PAGE_LIMIT) break;
        page++;
      }
      return all;
    }

    const perDay = await Promise.all(dates.map(fetchAllForDate));

    const companies = perDay.flat();

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
