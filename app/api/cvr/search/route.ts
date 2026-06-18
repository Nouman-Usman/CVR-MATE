import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { searchCompaniesElasticsearch, type ParsedCompany } from "@/lib/cvr-api-elasticsearch";
import { reserveMonthlyQuota } from "@/lib/stripe/entitlements";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimit(session.user.id, "cvr_search", 30, 60, { failClosed: true });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Maximum 30 searches per minute." },
        { status: 429 }
      );
    }

    const params = req.nextUrl.searchParams;

    // Extract pagination params
    const page = params.get("page") ? Number(params.get("page")) : 1;
    const limit = params.get("limit") ? Number(params.get("limit")) : 20;

    // Map filter params to Elasticsearch filter structure
    const filters: Record<string, string> = {};

    if (params.has("name")) filters.life_name = params.get("name") || "";
    if (params.has("zipcode")) filters.address_zipcode = params.get("zipcode") || "";
    if (params.has("industry_code")) filters.industry_primary_code = params.get("industry_code") || "";
    if (params.has("industry_secondary_code")) filters.industry_secondary_code = params.get("industry_secondary_code") || "";
    if (params.has("companyform_code")) filters.companyform_code = params.get("companyform_code") || "";
    if (params.has("companystatus_code")) filters.company_status_code = params.get("companystatus_code") || "";
    if (params.has("ad_protected")) filters.life_adprotected = params.get("ad_protected") || "";

    // Check if at least one filter is provided
    const hasAnyFilter = Object.values(filters).some((v) => v);
    if (!hasAnyFilter) {
      return NextResponse.json(
        { error: "At least one search filter is required" },
        { status: 400 }
      );
    }

    const quota = await reserveMonthlyQuota(session.user.id, "company_search");
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Search limit reached (${quota.used}/${quota.limit}). Upgrade for more.`,
          upgrade: true,
        },
        { status: 403 }
      );
    }

    // Search via Elasticsearch
    const result = await searchCompaniesElasticsearch(filters, page, limit);

    // Enrich results for frontend (add computed fields)
    const enriched = result.companies.map((c) => ({
      ...c,
      _employeeCount: c.employees !== "–" ? parseInt(c.employees) : null,
    }));

    return NextResponse.json({
      results: enriched,
      count: enriched.length,
      total: result.total,
      hasMore: result.hasMore,
      truncated: false,
    });
  } catch (error) {
    console.error("CVR search error:", error);
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
