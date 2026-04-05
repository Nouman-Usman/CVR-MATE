import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { generateAiJson } from "@/lib/ai";
import { getUserBrand } from "@/lib/get-user-brand";
import { checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";

interface ParsedFilters {
  query: string;
  industryText: string;
  industryCode: string;
  companyForm: string;
  size: string;
  zipcode: string;
  region: string;
  foundedPeriod: string;
  revenueMin: number;
  revenueMax: number;
  profitMin: number;
  profitMax: number;
  employeesMin: number;
  employeesMax: number;
}

interface ParseResponse {
  filters: ParsedFilters;
  explanation: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quota = await checkMonthlyQuota(session.user.id, "ai_usage");
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `AI usage limit reached (${quota.used}/${quota.limit}). Upgrade for more.`, upgrade: true },
        { status: 403 }
      );
    }

    const { query, locale = "en" } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 5) {
      return NextResponse.json(
        { error: "Search query must be at least 5 characters" },
        { status: 400 }
      );
    }

    const lang = locale === "da" ? "Danish" : "English";
    const brand = await getUserBrand(session.user.id);
    const brandNote = brand ? ` The user works in ${brand.industry ?? "an unspecified industry"} and sells: ${brand.products}. If the query is ambiguous, prefer interpretations relevant to their industry.` : "";

    const systemPrompt = `You are a search query interpreter for a Danish business registry platform. Convert natural language queries into structured search filters. Always respond in ${lang} for the explanation field.${brandNote}`;

    const userPrompt = `Convert this natural language search into structured filters:

QUERY: "${query.trim()}"

AVAILABLE FILTER FIELDS AND VALID VALUES:

1. query (string): Company name or CVR number to search for. Use this for specific company names.

2. industryText (string): Free-text industry description like "IT", "restaurant", "byggeri", "construction"

3. industryCode (string): One of these codes or "all":
   - "all" = All industries
   - "46" = Wholesale trade / Engroshandel
   - "47" = Retail trade / Detailhandel
   - "62" = IT programming / IT-programmering
   - "41" = Construction / Byggeri
   - "56" = Restaurants / Restauranter
   - "86" = Healthcare / Sundhedsvæsen
   - "70" = Business consulting / Virksomhedsrådgivning
   - "43" = Specialized construction / Specialiseret byggeri
   - "68" = Real estate / Ejendomshandel

4. companyForm (string): One of: "all", "aps", "a/s", "ivs", "i/s", "enkeltmandsvirksomhed"

5. size (string): One of: "all", "1-4", "5-9", "10-19", "20-49", "50-99", "100+"

6. zipcode (string): Danish postal code, e.g. "2100", "8000"

7. region (string): One of: "all", "hovedstaden" (Capital/Copenhagen), "midtjylland" (Central Jutland/Aarhus), "syddanmark" (Southern Denmark/Odense), "nordjylland" (Northern Jutland/Aalborg), "sjaelland" (Zealand)

8. foundedPeriod (string): "all" or leave empty

9. revenueMin / revenueMax (number): Revenue range in millions DKK. Default: 0-1000.
10. profitMin / profitMax (number): Profit range in millions DKK. Default: 0-1000.
11. employeesMin / employeesMax (number): Employee count range. Default: 0-5000.

CITY-TO-REGION MAPPING:
- København/Copenhagen → "hovedstaden"
- Aarhus/Århus → "midtjylland"
- Odense → "syddanmark"
- Aalborg/Ålborg → "nordjylland"
- Roskilde, Næstved → "sjaelland"

RULES:
- For fields not mentioned in the query, use defaults: "all" for dropdowns, "" for text, 0/1000/5000 for ranges
- If the user mentions a number of employees like "20+", set employeesMin=20 and employeesMax=5000
- If the user mentions a specific city, set the region accordingly and/or set zipcode if known
- Match industry mentions to the closest industryCode when possible, otherwise use industryText
- The "query" field should only be set if the user is searching for a specific company name

Respond with a JSON object:
{
  "filters": { ...all filter fields with values... },
  "explanation": "Brief human-readable summary of what you understood"
}`;

    const raw = await generateAiJson<Record<string, unknown>>({
      model: "gemini-2.5-flash",
      systemPrompt,
      userPrompt,
      maxTokens: 768,
    });

    // Normalize — filters may be at top level or nested under "filters"
    const filtersObj = (raw.filters ?? raw) as Record<string, unknown>;
    const result: ParseResponse = {
      filters: {
        query: (filtersObj.query as string) ?? "",
        industryText: (filtersObj.industryText ?? filtersObj.industry_text ?? "") as string,
        industryCode: (filtersObj.industryCode ?? filtersObj.industry_code ?? "all") as string,
        companyForm: (filtersObj.companyForm ?? filtersObj.company_form ?? "all") as string,
        size: (filtersObj.size ?? "all") as string,
        zipcode: (filtersObj.zipcode ?? "") as string,
        region: (filtersObj.region ?? "all") as string,
        foundedPeriod: (filtersObj.foundedPeriod ?? filtersObj.founded_period ?? "all") as string,
        revenueMin: Number(filtersObj.revenueMin ?? filtersObj.revenue_min ?? 0),
        revenueMax: Number(filtersObj.revenueMax ?? filtersObj.revenue_max ?? 1000),
        profitMin: Number(filtersObj.profitMin ?? filtersObj.profit_min ?? 0),
        profitMax: Number(filtersObj.profitMax ?? filtersObj.profit_max ?? 1000),
        employeesMin: Number(filtersObj.employeesMin ?? filtersObj.employees_min ?? 0),
        employeesMax: Number(filtersObj.employeesMax ?? filtersObj.employees_max ?? 5000),
      },
      explanation: (raw.explanation ?? raw.Explanation ?? raw.summary ?? "") as string,
    };

    await recordUsage(session.user.id, "ai_usage");
    return NextResponse.json(result);
  } catch (error) {
    console.error("AI parse-search error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to parse search";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
