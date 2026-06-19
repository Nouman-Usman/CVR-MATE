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

    // Extract + validate pagination params
    const pageRaw = Number(params.get("page")) || 1;
    const limitRaw = Number(params.get("limit")) || 10;
    const page = Math.max(1, Math.min(pageRaw, 1000));
    const limit = Math.max(1, Math.min(limitRaw, 100));

    if (!Number.isInteger(pageRaw) || !Number.isInteger(limitRaw) || pageRaw < 1 || limitRaw < 1) {
      return NextResponse.json({ error: "Invalid pagination parameters" }, { status: 400 });
    }

    // Map filter params to Elasticsearch filter structure
    const filters: Record<string, string> = {};

    if (params.has("name")) filters.life_name = params.get("name") || "";
    if (params.has("zipcode")) filters.address_zipcode = params.get("zipcode") || "";
    if (params.has("zipcode_list")) filters.zipcode_list = params.get("zipcode_list") || "";
    if (params.has("city")) filters.city = params.get("city") || "";
    if (params.has("municipality")) filters.municipality = params.get("municipality") || "";
    if (params.has("street")) filters.street = params.get("street") || "";
    if (params.has("number_from")) filters.number_from = params.get("number_from") || "";
    if (params.has("industry_code")) filters.industry_primary_code = params.get("industry_code") || "";
    if (params.has("industry_secondary_code")) filters.industry_secondary_code = params.get("industry_secondary_code") || "";
    if (params.has("companyform_code")) filters.companyform_code = params.get("companyform_code") || "";
    if (params.has("companystatus_code")) filters.company_status_code = params.get("companystatus_code") || "";
    if (params.has("life_start")) filters.life_start = params.get("life_start") || "";
    if (params.has("phone")) filters.contact_phone = params.get("phone") || "";
    if (params.has("email")) filters.contact_email = params.get("email") || "";
    if (params.has("website")) filters.contact_www = params.get("website") || "";
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
    console.error("CVR search error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
