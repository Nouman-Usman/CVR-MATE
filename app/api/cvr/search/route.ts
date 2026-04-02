import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  searchCompanies,
  type SearchCompanyParams,
  type CvrCompany,
} from "@/lib/cvr-api";
import { checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";

// Extract latest financial summary from a company's accounting documents
function getLatestSummary(c: CvrCompany) {
  const docs = c.accounting?.documents;
  if (!Array.isArray(docs)) return null;
  for (const doc of docs) {
    if (doc.summary) return doc.summary;
  }
  return null;
}

// Get latest employee count from employment data
function getEmployeeCount(c: CvrCompany): number | null {
  const m = c.employment?.months?.[0];
  if (m?.amount != null) return m.amount;
  const y = c.employment?.years?.[0];
  if (y?.amount != null) return y.amount;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quota = await checkMonthlyQuota(session.user.id, "company_search");
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `Search limit reached (${quota.used}/${quota.limit}). Upgrade for more.`, upgrade: true },
        { status: 403 }
      );
    }

    const params = req.nextUrl.searchParams;
    const searchParams: SearchCompanyParams = {};

    // Map frontend query param names → CVR API param names
    const mapping: Record<string, keyof SearchCompanyParams> = {
      name: "life_name",
      life_start: "life_start",
      life_end: "life_end",
      zipcode: "address_zipcode",
      zipcode_list: "address_zipcode_list",
      city: "address_city",
      municipality: "address_municipality",
      companyform_code: "companyform_code",
      companyform_description: "companyform_description",
      companystatus_code: "companystatus_code",
      industry_text: "industry_primary_text",
      industry_code: "industry_primary_code",
      industry_secondary_text: "industry_secondary_text",
      industry_secondary_code: "industry_secondary_code",
      employment_amount: "employment_amount",
      employment_interval_low: "employment_interval_low",
      phone: "contact_phone",
      email: "contact_email",
      website: "contact_www",
      bankrupt: "status_bankrupt",
      capital: "capital_capital",
      ipo: "capital_ipo",
    };

    for (const [queryKey, apiKey] of Object.entries(mapping)) {
      const value = params.get(queryKey);
      if (value && value !== "all") {
        searchParams[apiKey] = value;
      }
    }

    // Default to active companies if no status specified
    if (!searchParams.companystatus_code) {
      searchParams.companystatus_code = "20";
    }

    // Check for segmentation post-filters (not part of CVR API)
    const segEmployeesMax = params.get("seg_employees_max");
    const segRevenueMin = params.get("seg_revenue_min");
    const segRevenueMax = params.get("seg_revenue_max");
    const segProfitMin = params.get("seg_profit_min");
    const segProfitMax = params.get("seg_profit_max");

    const hasAnyFilter = Object.entries(searchParams).some(
      ([k, v]) => v && k !== "companystatus_code" && k !== "page"
    );

    // Also count segmentation filters as valid
    const hasSegFilter = !!(
      segEmployeesMax ||
      segRevenueMin ||
      segRevenueMax ||
      segProfitMin ||
      segProfitMax
    );

    if (!hasAnyFilter && !hasSegFilter) {
      return NextResponse.json(
        { error: "At least one search filter is required" },
        { status: 400 }
      );
    }

    // If only segmentation filters are set (no CVR API filters),
    // we need at least one CVR API filter — use status as baseline
    if (!hasAnyFilter && hasSegFilter) {
      // companystatus_code "20" is already set — that alone won't pass the
      // CVR API's requirement for a real search term, so reject gracefully.
      return NextResponse.json(
        { error: "At least one search filter is required" },
        { status: 400 }
      );
    }

    // Pass page directly to CVR API — each page returns ~10 results
    const page = parseInt(params.get("page") || "1", 10);
    searchParams.page = String(page);

    const results = await searchCompanies(searchParams);
    let pageResults = Array.isArray(results) ? results : [];

    // ─── Apply segmentation post-filters ───
    if (segEmployeesMax) {
      const max = Number(segEmployeesMax);
      pageResults = pageResults.filter((c) => {
        const count = getEmployeeCount(c);
        return count == null || count <= max;
      });
    }

    if (segRevenueMin || segRevenueMax) {
      const minVal = segRevenueMin ? Number(segRevenueMin) * 1_000_000 : 0;
      const maxVal = segRevenueMax ? Number(segRevenueMax) * 1_000_000 : Infinity;
      pageResults = pageResults.filter((c) => {
        const summary = getLatestSummary(c);
        const revenue = summary?.revenue ?? summary?.grossprofitloss;
        if (revenue == null) return true;
        return revenue >= minVal && revenue <= maxVal;
      });
    }

    if (segProfitMin || segProfitMax) {
      const minVal = segProfitMin ? Number(segProfitMin) * 1_000_000 : 0;
      const maxVal = segProfitMax ? Number(segProfitMax) * 1_000_000 : Infinity;
      pageResults = pageResults.filter((c) => {
        const summary = getLatestSummary(c);
        const profit = summary?.grossprofitloss;
        if (profit == null) return true;
        return profit >= minVal && profit <= maxVal;
      });
    }

    // Only count as a usage on the first page
    if (page === 1) {
      await recordUsage(session.user.id, "company_search");
    }

    // CVR API returns ~10 per page. If fewer, there are no more results.
    const hasMore = pageResults.length >= 10;

    return NextResponse.json({
      results: pageResults,
      count: pageResults.length,
      total: pageResults.length,
      page,
      hasMore,
    });
  } catch (error) {
    console.error("CVR search error:", error);
    const message =
      error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
