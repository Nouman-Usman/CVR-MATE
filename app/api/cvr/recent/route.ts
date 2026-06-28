import { NextRequest, NextResponse } from "next/server";
import { searchCompaniesElasticsearch, type ParsedCompany } from "@/lib/cvr-api-elasticsearch";
import { cacheGet, cacheSet } from "@/lib/redis";
import { cacheKey, CACHE_TTL } from "@/lib/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimit(session.user.id, "cvr_recent", 10, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Maximum 10 recent-company requests per minute." },
        { status: 429 }
      );
    }

    const days = Number(req.nextUrl.searchParams.get("days") || "7");
    const safeDays = Math.min(Math.max(days, 1), 7); // max 1 week

    const force = req.nextUrl.searchParams.get("force") === "1";

    // Check Redis cache first (skip if force refresh)
    const key = cacheKey.recent(safeDays);
    if (!force) {
      const cached = await cacheGet<{ results: ParsedCompany[]; count: number; from: string }>(key);
      if (cached) return NextResponse.json(cached);
    }

    const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    const cutoffDate = cutoff.toISOString().split("T")[0];
    const fromStr = cutoffDate;

    // Single ES range query on stiftelsesDato — paginate to collect all results
    const ES_PAGE_SIZE = 100;
    const MAX_PAGES = 10;
    const all: ParsedCompany[] = [];
    for (let p = 1; p <= MAX_PAGES; p++) {
      const result = await searchCompaniesElasticsearch(
        { life_start: cutoffDate },
        p,
        ES_PAGE_SIZE
      );
      all.push(...result.companies);
      if (!result.hasMore) break;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const activeStatuses = new Set(["NORMAL", "AKTIV", "FREMTID", ""]);

    // Sort newest first, deduplicate by VAT, exclude future-dated and truly dissolved
    all.sort((a, b) => (b.founded ?? "").localeCompare(a.founded ?? ""));
    const seen = new Set<number>();
    const unique = all.filter((c) => {
      if (seen.has(c.vat)) return false;
      // Exclude future start dates (pre-registered companies not yet active)
      if (c.founded && c.founded > todayStr) return false;
      // Exclude dissolved/cancelled companies — only show active or future
      if (c.status && !activeStatuses.has(c.status.toUpperCase())) return false;
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
