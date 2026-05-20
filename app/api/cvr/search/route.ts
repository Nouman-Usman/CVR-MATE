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

// Post-filter using ONLY the 21 CVR API search params. Catches mismatches the
// fan-out variations let through. Company form / status / capital / LEI / EAN
// are intentionally not enforced — they are not part of the search endpoint.
function matchesNativeFilters(c: CvrCompany, searchParams: SearchCompanyParams): boolean {
  if (searchParams.life_name) {
    const query = normalizeText(searchParams.life_name);
    const matchesVat = /^\d+$/.test(query) && String(c.vat).includes(query);
    const matchesName = getSearchableCompanyNames(c).some((name) => name.includes(query));
    if (!matchesVat && !matchesName) return false;
  }

  if (searchParams.life_start) {
    const founded = c.life?.start;
    if (!founded || founded < searchParams.life_start) return false;
  }

  if (searchParams.life_end) {
    const ended = c.life?.end;
    if (!ended || ended > searchParams.life_end) return false;
  }

  if (searchParams.life_adprotected === "false" && c.life?.adprotected) return false;
  if (searchParams.life_adprotected === "true" && !c.life?.adprotected) return false;

  const addr = c.address as Record<string, unknown> | undefined;

  if (searchParams.address_street) {
    const actual = normalizeText(addr?.street);
    if (!actual.includes(normalizeText(searchParams.address_street))) return false;
  }

  if (searchParams.address_streetcode) {
    if (String(addr?.streetcode ?? "") !== searchParams.address_streetcode) return false;
  }

  if (searchParams.address_zipcode) {
    if (String(c.address?.zipcode ?? "") !== searchParams.address_zipcode) return false;
  }

  if (searchParams.address_zipcode_list) {
    const allowed = new Set(
      searchParams.address_zipcode_list.split(",").map((z) => z.trim()).filter(Boolean)
    );
    if (!allowed.has(String(c.address?.zipcode ?? ""))) return false;
  }

  if (searchParams.address_city) {
    const actual = normalizeText(c.address?.cityname);
    if (!actual.includes(normalizeText(searchParams.address_city))) return false;
  }

  if (searchParams.address_municipality) {
    const actual = normalizeText(c.address?.municipalityname);
    if (!actual.includes(normalizeText(searchParams.address_municipality))) return false;
  }

  if (searchParams.contact_phone) {
    if (normalizeText(c.contact?.phone) !== normalizeText(searchParams.contact_phone)) return false;
  }

  if (searchParams.contact_email) {
    if (normalizeText(c.contact?.email) !== normalizeText(searchParams.contact_email)) return false;
  }

  if (searchParams.contact_www) {
    const actual = normalizeText(c.contact?.www);
    if (!actual.includes(normalizeText(searchParams.contact_www))) return false;
  }

  if (searchParams.industry_primary_code) {
    const actual = String(c.industry?.primary?.code ?? "");
    if (!actual.startsWith(searchParams.industry_primary_code)) return false;
  }

  if (searchParams.industry_primary_text) {
    const actual = normalizeText(c.industry?.primary?.text);
    if (!actual.includes(normalizeText(searchParams.industry_primary_text))) return false;
  }

  if (searchParams.industry_secondary_code) {
    const matches = (c.industry?.secondary ?? []).some((s) =>
      String(s.code ?? "").startsWith(searchParams.industry_secondary_code!)
    );
    if (!matches) return false;
  }

  if (searchParams.industry_secondary_text) {
    const needle = normalizeText(searchParams.industry_secondary_text);
    const matches = (c.industry?.secondary ?? []).some((s) =>
      normalizeText(s.text).includes(needle)
    );
    if (!matches) return false;
  }

  if (searchParams.employment_amount) {
    const expected = Number(searchParams.employment_amount);
    const count = getEmployeeCount(c);
    if (!Number.isFinite(expected) || count == null || count !== expected) return false;
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

    // Strict map of the 21 query params the CVR API v2 search/company endpoint
    // accepts. Anything outside this list is ignored — keeps the search surface
    // honest to the spec.
    const mapping: Record<string, keyof SearchCompanyParams> = {
      name: "life_name",
      life_start: "life_start",
      life_end: "life_end",
      ad_protected: "life_adprotected",
      street: "address_street",
      streetcode: "address_streetcode",
      number_from: "address_numberfrom",
      letter_from: "address_letterfrom",
      zipcode: "address_zipcode",
      zipcode_list: "address_zipcode_list",
      city: "address_city",
      municipality: "address_municipality",
      phone: "contact_phone",
      email: "contact_email",
      website: "contact_www",
      industry_text: "industry_primary_text",
      industry_code: "industry_primary_code",
      industry_secondary_text: "industry_secondary_text",
      industry_secondary_code: "industry_secondary_code",
      employment_amount: "employment_amount",
      employment_interval_low: "employment_interval_low",
    };

    for (const [queryKey, apiKey] of Object.entries(mapping)) {
      const value = params.get(queryKey);
      if (value && value !== "all") {
        searchParams[apiKey] = value;
      }
    }

    // Upstream CVR expects industry_primary_code as a full 6-digit DB07 NACE
    // integer. Short codes (category prefixes like "62") would match the int
    // exactly, returning near-empty results. When < 6 digits, drop from the
    // upstream call but keep for post-filtering via `matchesNativeFilters`,
    // which uses `.startsWith()` against the broader candidate pool.
    const upstreamParams: SearchCompanyParams = { ...searchParams };
    if (
      typeof upstreamParams.industry_primary_code === "string" &&
      upstreamParams.industry_primary_code.length < 6
    ) {
      delete upstreamParams.industry_primary_code;
    }
    if (
      typeof upstreamParams.industry_secondary_code === "string" &&
      upstreamParams.industry_secondary_code.length < 6
    ) {
      delete upstreamParams.industry_secondary_code;
    }

    // Check for segmentation post-filters (not part of CVR API)
    const segEmployeesMin = params.get("seg_employees_min");
    const segEmployeesMax = params.get("seg_employees_max");
    const segRevenueMin = params.get("seg_revenue_min");
    const segRevenueMax = params.get("seg_revenue_max");
    const segProfitMin = params.get("seg_profit_min");
    const segProfitMax = params.get("seg_profit_max");

    const hasAnyFilter = Object.entries(searchParams).some(
      ([k, v]) =>
        v &&
        k !== "companystatus_code" &&
        k !== "page" &&
        k !== "life_adprotected"
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

    // CVR API v2.0.0 has no pagination — each call returns ~10 rows max. To
    // expand coverage we fan out parallel queries with varied inputs and dedupe
    // by vat. Filter-only and segmentation-only searches use an alphabet sweep
    // on `life_name` against the same filter set.
    const seen = new Set<number>();
    const all: CvrCompany[] = [];
    let truncated = false;

    function addBatch(batch: CvrCompany[]) {
      if (batch.length >= 10) truncated = true;
      for (const c of batch) {
        if (!seen.has(c.vat)) {
          seen.add(c.vat);
          all.push(c);
        }
      }
    }

    const nameQuery = upstreamParams.life_name;
    const zipList = upstreamParams.address_zipcode_list;

    // 1. Base search — always runs
    const baseResults = await searchCompanies(upstreamParams).catch(() => [] as CvrCompany[]);
    addBatch(baseResults);

    // 2. Fan out parallel variation queries.
    const variationCalls: Promise<CvrCompany[]>[] = [];
    const ALPHABET = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p"];

    if (nameQuery && nameQuery.length >= 1) {
      // Name variations: append letters that yield different result sets
      const suffixes = ["a", "b", "c", "d", "e", "s", "i", "k", "m", "n", "p"];
      for (const s of suffixes) {
        variationCalls.push(
          searchCompanies({ ...upstreamParams, life_name: `${nameQuery} ${s}` }).catch(() => [])
        );
      }
      variationCalls.push(suggestCompanies(nameQuery).catch(() => []));
    } else if (zipList && zipList.split(",").length > 25) {
      // Region/multi-zip search: chunk the zip list into ~25-zip slices so each
      // call returns a different geographic slice rather than the same 10 rows.
      const zips = zipList.split(",").map((z) => z.trim()).filter(Boolean);
      const chunkSize = 25;
      for (let i = 0; i < zips.length; i += chunkSize) {
        const chunk = zips.slice(i, i + chunkSize).join(",");
        variationCalls.push(
          searchCompanies({ ...upstreamParams, address_zipcode_list: chunk }).catch(() => [])
        );
        if (variationCalls.length >= 20) break;
      }
    } else {
      // Filter-only or segmentation-only: alphabet sweep on life_name to force
      // CVR to return different name-indexed slices while preserving all other
      // native filters in upstreamParams.
      for (const letter of ALPHABET) {
        variationCalls.push(
          searchCompanies({ ...upstreamParams, life_name: letter }).catch(() => [])
        );
      }
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
      truncated,
    });
  } catch (error) {
    console.error("CVR search error:", error);
    const message =
      error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
