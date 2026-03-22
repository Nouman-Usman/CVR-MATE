import { NextRequest, NextResponse } from "next/server";
import { searchCompanies, type SearchCompanyParams } from "@/lib/cvr-api";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const searchParams: SearchCompanyParams = {};

    // Map query params to CVR API params
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

    return NextResponse.json({
      results: Array.isArray(results) ? results : [],
      count: Array.isArray(results) ? results.length : 0,
    });
  } catch (error) {
    console.error("CVR search error:", error);
    const message =
      error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
