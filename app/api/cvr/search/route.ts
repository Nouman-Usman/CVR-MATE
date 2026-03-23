import { NextRequest, NextResponse } from "next/server";
import { searchCompanies, type SearchCompanyParams } from "@/lib/cvr-api";

export async function GET(req: NextRequest) {
  try {
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

    const hasAnyFilter = Object.values(searchParams).some(
      (v) => v && v !== "20"
    );

    if (!hasAnyFilter) {
      return NextResponse.json(
        { error: "At least one search filter is required" },
        { status: 400 }
      );
    }

    const results = await searchCompanies(searchParams);

    // Client-side pagination: the CVR API returns all matches at once
    const page = parseInt(params.get("page") || "1", 10);
    const pageSize = parseInt(params.get("limit") || "50", 10);
    const allResults = Array.isArray(results) ? results : [];
    const start = (page - 1) * pageSize;
    const paged = allResults.slice(start, start + pageSize);

    return NextResponse.json({
      results: paged,
      count: paged.length,
      total: allResults.length,
      page,
      limit: pageSize,
      hasMore: start + pageSize < allResults.length,
    });
  } catch (error) {
    console.error("CVR search error:", error);
    const message =
      error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
