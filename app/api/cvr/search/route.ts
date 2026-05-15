import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  searchCompanies,
  suggestCompanies,
  type SearchCompanyParams,
  type CvrCompany,
} from "@/lib/cvr-api";
import { checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";
import { checkRateLimit } from "@/lib/rate-limit";

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

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isActiveCompany(c: CvrCompany): boolean {
  const statusText = normalizeText(c.companystatus?.text);
  const hasEnded = !!c.life?.end;

  if (hasEnded) return false;
  if (!statusText) return true;

  return ["normal", "i drift", "active"].includes(statusText);
}

function getSearchableCompanyNames(c: CvrCompany): string[] {
  const raw = c as CvrCompany & {
    secondarynames?: string[];
    subsidiaries?: { life?: { name?: string | null } }[];
  };

  return [
    c.life?.name,
    c.slug,
    ...(raw.secondarynames ?? []),
    ...(raw.subsidiaries ?? []).map((subsidiary) => subsidiary.life?.name),
  ]
    .map(normalizeText)
    .filter(Boolean);
}

function matchesNativeFilters(c: CvrCompany, searchParams: SearchCompanyParams): boolean {
  if (searchParams.companystatus_code === "20" && !isActiveCompany(c)) {
    return false;
  }

  if (searchParams.life_name) {
    const query = normalizeText(searchParams.life_name);
    const matchesVat = /^\d+$/.test(query) && String(c.vat).includes(query);
    const matchesName = getSearchableCompanyNames(c).some((name) => name.includes(query));
    if (!matchesVat && !matchesName) return false;
  }

  if (searchParams.companyform_code) {
    const expected = Number(searchParams.companyform_code);
    if (Number.isFinite(expected) && c.companyform?.code !== expected) return false;
  }

  if (searchParams.companyform_description) {
    const actual = normalizeText(c.companyform?.description);
    if (actual !== normalizeText(searchParams.companyform_description)) return false;
  }

  if (searchParams.industry_primary_code) {
    const actual = String(c.industry?.primary?.code ?? "");
    if (!actual.startsWith(searchParams.industry_primary_code)) return false;
  }

  if (searchParams.industry_primary_text) {
    const actual = normalizeText(c.industry?.primary?.text);
    if (!actual.includes(normalizeText(searchParams.industry_primary_text))) return false;
  }

  if (searchParams.address_zipcode) {
    const actual = String(c.address?.zipcode ?? "");
    if (actual !== searchParams.address_zipcode) return false;
  }

  if (searchParams.address_zipcode_list) {
    const allowed = new Set(
      searchParams.address_zipcode_list
        .split(",")
        .map((zip) => zip.trim())
        .filter(Boolean)
    );
    const actual = String(c.address?.zipcode ?? "");
    if (!allowed.has(actual)) return false;
  }

  if (searchParams.address_city) {
    const actual = normalizeText(c.address?.cityname);
    if (!actual.includes(normalizeText(searchParams.address_city))) return false;
  }

  if (searchParams.address_municipality) {
    const actual = normalizeText(c.address?.municipalityname);
    if (!actual.includes(normalizeText(searchParams.address_municipality))) return false;
  }

  if (searchParams.life_start) {
    const founded = c.life?.start;
    if (!founded || founded < searchParams.life_start) return false;
  }

  if (searchParams.life_end) {
    const ended = c.life?.end;
    if (!ended || ended > searchParams.life_end) return false;
  }

  if (searchParams.employment_interval_low) {
    const min = Number(searchParams.employment_interval_low);
    const count = getEmployeeCount(c);
    if (Number.isFinite(min) && (count == null || count < min)) return false;
  }

  return true;
}

// ─── Route handler ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimit(session.user.id, "cvr_search", 30, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Maximum 30 searches per minute." },
        { status: 429 }
      );
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

    // Default to active companies if no status specified.
    // User can opt into "all" (including dissolved) via showDissolved toggle.
    const statusParam = params.get("status");
    if (!searchParams.companystatus_code && statusParam !== "all") {
      searchParams.companystatus_code = "20";
    }

    // Check for segmentation post-filters (not part of CVR API)
    const segEmployeesMin = params.get("seg_employees_min");
    const segEmployeesMax = params.get("seg_employees_max");
    const segRevenueMin = params.get("seg_revenue_min");
    const segRevenueMax = params.get("seg_revenue_max");
    const segProfitMin = params.get("seg_profit_min");
    const segProfitMax = params.get("seg_profit_max");

    const hasAnyFilter = Object.entries(searchParams).some(
      ([k, v]) => v && k !== "companystatus_code" && k !== "page"
    );

    const hasSegFilter = !!(
      segEmployeesMin ||
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

    // CVR does not support match-all searches or financial segmentation.
    // Require at least one native search filter instead of returning a misleading slice.
    if (!hasAnyFilter && hasSegFilter) {
      return NextResponse.json(
        {
          error:
            "At least one CVR search filter is required with segmentation. Add a name, industry, location, company form, founding date, or employee minimum.",
        },
        { status: 400 }
      );
    }

    // CVR API returns a fixed ~10 results per search call. The `page` param
    // returns duplicates (confirmed by testing). To get more results, we make
    // multiple parallel calls with query variations (appending suffix letters).
    const seen = new Set<number>();
    const all: CvrCompany[] = [];

    function addBatch(batch: CvrCompany[]) {
      for (const c of batch) {
        if (!seen.has(c.vat)) {
          seen.add(c.vat);
          all.push(c);
        }
      }
    }

    // 1. Base search — always runs
    const baseResults = await searchCompanies(searchParams).catch(() => [] as CvrCompany[]);
    addBatch(baseResults);

    // 2. Fire parallel variation queries to get more results.
    //    The CVR API returns different results for slightly different queries.
    const nameQuery = searchParams.life_name;
    const variationCalls: Promise<CvrCompany[]>[] = [];

    if (nameQuery && nameQuery.length >= 1) {
      // Name variations: append common Danish prefixes that yield different result sets
      const suffixes = ["a", "b", "c", "d", "e", "s", "i", "k", "m", "n", "p"];
      for (const s of suffixes) {
        variationCalls.push(
          searchCompanies({ ...searchParams, life_name: `${nameQuery} ${s}` }).catch(() => [])
        );
      }
      // Also try the suggestions endpoint (different matching algorithm)
      variationCalls.push(
        suggestCompanies(nameQuery).catch(() => [])
      );
    }

    if (variationCalls.length > 0) {
      const batches = await Promise.all(variationCalls);
      for (const batch of batches) addBatch(batch);
    }

    // Suggestion/name-variation calls can return broader matches than the base
    // CVR query. Re-apply native filters before app-only segmentation.
    let pageResults = all.filter((c) => matchesNativeFilters(c, searchParams));

    // ─── Apply segmentation post-filters ───
    if (segEmployeesMin || segEmployeesMax) {
      const min = segEmployeesMin ? Number(segEmployeesMin) : 0;
      const max = segEmployeesMax ? Number(segEmployeesMax) : Infinity;
      pageResults = pageResults.filter((c) => {
        const count = getEmployeeCount(c);
        if (count == null) return false;
        return count >= min && count <= max;
      });
    }

    if (segRevenueMin || segRevenueMax) {
      const minVal = segRevenueMin ? Number(segRevenueMin) * 1_000_000 : 0;
      const maxVal = segRevenueMax ? Number(segRevenueMax) * 1_000_000 : Infinity;
      pageResults = pageResults.filter((c) => {
        const summary = getLatestSummary(c);
        const revenue = summary?.revenue;
        if (revenue == null) return false;
        return revenue >= minVal && revenue <= maxVal;
      });
    }

    if (segProfitMin || segProfitMax) {
      const minVal = segProfitMin ? Number(segProfitMin) * 1_000_000 : 0;
      const maxVal = segProfitMax ? Number(segProfitMax) * 1_000_000 : Infinity;
      pageResults = pageResults.filter((c) => {
        const summary = getLatestSummary(c);
        const profit = summary?.grossprofitloss;
        if (profit == null) return false;
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
