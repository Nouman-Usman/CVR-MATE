import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  searchCompanies,
  type SearchCompanyParams,
  type CvrCompany,
} from "@/lib/cvr-api";
import { checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";

// ─── Data extraction helpers (sorted for accuracy) ─────────────────────────

/** Extract the LATEST financial summary — sorts by document end date, not array order */
function getLatestSummary(c: CvrCompany) {
  const docs = c.accounting?.documents;
  if (!Array.isArray(docs) || docs.length === 0) return null;

  // Documents may have end/publicdate fields not in the base type
  const sorted = [...docs].sort((a, b) => {
    const raw = (x: unknown) => x as Record<string, unknown>;
    const dateA = new Date((raw(a).end || raw(a).publicdate || 0) as string).getTime();
    const dateB = new Date((raw(b).end || raw(b).publicdate || 0) as string).getTime();
    return dateB - dateA;
  });

  return sorted.find((d) => d.summary)?.summary ?? null;
}

/** Extract the LATEST employee count — sorts months/years by recency */
function getEmployeeCount(c: CvrCompany): number | null {
  const months = [...(c.employment?.months ?? [])].sort(
    (a, b) => b.year - a.year || b.month - a.month
  );
  if (months[0]?.amount != null) return months[0].amount;

  const years = [...(c.employment?.years ?? [])].sort(
    (a, b) => b.year - a.year
  );
  if (years[0]?.amount != null) return years[0].amount;

  return null;
}

// ─── Enrichment: add computed fields so frontend doesn't recompute ──────────

function enrichResult(c: CvrCompany) {
  const summary = getLatestSummary(c);
  return {
    ...c,
    _employeeCount: getEmployeeCount(c),
    _revenue: summary?.revenue ?? null,
    _profit: summary?.grossprofitloss ?? null,
    _equity: summary?.equity ?? null,
  };
}

// ─── Route handler ──────────────────────────────────────────────────────────

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

    // Segmentation-only queries: inject a broad baseline so CVR API has something to work with
    if (!hasAnyFilter && hasSegFilter) {
      searchParams.life_start = "1900-01-01";
    }

    // CVR API has no documented pagination — returns a fixed ~10 results per call.
    // We return all results at once; the frontend shows a "refine filters" hint.
    const results = await searchCompanies(searchParams);
    const rawResults = Array.isArray(results) ? results : [];

    // Deduplicate by VAT
    const seen = new Set<number>();
    let pageResults = rawResults.filter((c) => {
      if (seen.has(c.vat)) return false;
      seen.add(c.vat);
      return true;
    });

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

    await recordUsage(session.user.id, "company_search");

    // Enrich results with computed fields so frontend doesn't recompute
    const enriched = pageResults.map(enrichResult);

    return NextResponse.json({
      results: enriched,
      count: enriched.length,
      hasMore: false,
    });
  } catch (error) {
    console.error("CVR search error:", error);
    const message =
      error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
