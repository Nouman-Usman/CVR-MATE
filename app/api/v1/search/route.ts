import { NextRequest } from "next/server";
import { searchCompanies, type SearchCompanyParams } from "@/lib/cvr-api";
import { validateApiKey, requireScope, handleApiKeyError } from "@/lib/api-key-auth";

// GET /api/v1/search — search CVR registry via API key
export async function GET(request: NextRequest) {
  try {
    const ctx = await validateApiKey(request.headers.get("authorization"));
    requireScope(ctx, "read");

    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";

    if (!query.trim()) {
      return Response.json({ error: "Query parameter 'q' is required" }, { status: 400 });
    }

    // Map external-facing params to CVR API params
    const params: SearchCompanyParams = {
      life_name: query,
    };

    const city = url.searchParams.get("city");
    if (city) params.address_city = city;

    const zipcode = url.searchParams.get("zipcode");
    if (zipcode) params.address_zipcode = zipcode;

    const results = await searchCompanies(params);

    return Response.json({ companies: results, count: results.length });
  } catch (error) {
    return handleApiKeyError(error);
  }
}
