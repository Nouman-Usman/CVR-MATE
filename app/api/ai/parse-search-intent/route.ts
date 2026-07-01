import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { regionCityZipcodeMap, zipcodeToRegionCity } from "@/lib/denmark-geodata";
import type { SearchFiltersState } from "@/lib/stores/search-store";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ParseResponse {
  filters: Partial<SearchFiltersState>;
  reasoning: string;
}

// Build city list string for prompt (region → top cities)
function buildCityContext(): string {
  return Object.entries(regionCityZipcodeMap)
    .map(([region, cities]) => {
      const cityList = cities.slice(0, 15).map(c => `${c.name} (${c.zipcodes[0]})`).join(", ");
      return `  ${region}: ${cityList}`;
    })
    .join("\n");
}

const SYSTEM_PROMPT = `You are an expert search filter parser for CVR-MATE, a Danish B2B company intelligence platform.

Your job: parse a plain-English or Danish search query and return ONLY a JSON object with matching CVR search filters. No explanations outside the JSON.

━━━ AVAILABLE FILTERS ━━━

**query** (string) — Company name keyword search

**industryCode** (string) — Primary NACE section code (2-digit):
  "01"=Agriculture, "02"=Forestry, "03"=Fishing
  "05"-"09"=Mining/extraction
  "10"-"12"=Food/beverage/tobacco manufacturing
  "13"-"15"=Textile/leather
  "16"-"18"=Wood/paper/printing
  "19"-"23"=Chemical/plastics/rubber/glass
  "24"-"25"=Metal/steel
  "26"=Electronics/computers, "27"=Electrical equipment, "28"=Machinery
  "29"=Motor vehicles, "30"=Other transport equipment
  "31"-"32"=Furniture/other manufacturing
  "35"=Energy/utilities (electricity, gas, heat)
  "36"-"39"=Water/waste/environmental
  "41"=Building construction, "42"=Civil engineering, "43"=Specialized construction (electricians, plumbers, painters)
  "45"=Motor vehicle trade/repair, "46"=Wholesale trade, "47"=Retail trade
  "49"=Land transport/haulage, "50"=Water transport, "51"=Air transport, "52"=Warehousing/logistics
  "55"=Hotels/accommodation, "56"=Restaurants/cafes/catering
  "58"=Publishing, "59"=Film/TV/music, "60"=Broadcasting
  "61"=Telecommunications, "62"=IT software/programming/consulting, "63"=Data services/hosting
  "64"=Banking/finance, "65"=Insurance, "66"=Financial services
  "68"=Real estate, "69"=Legal/accounting, "70"=Management consulting/business consulting
  "71"=Architecture/engineering, "72"=Scientific research, "73"=Advertising/marketing
  "74"=Other professional services, "75"=Veterinary
  "77"=Rental/leasing, "78"=HR/recruitment, "79"=Travel agencies, "80"=Security
  "81"=Facility services/cleaning, "82"=Office admin/support
  "84"=Public administration, "85"=Education/schools
  "86"=Healthcare/hospitals/doctors, "87"=Residential care, "88"=Social work
  "90"=Arts/entertainment, "91"=Libraries/museums, "92"=Gambling, "93"=Sports/recreation
  "94"=Associations/organizations, "95"=Computer/electronics repair, "96"=Personal services (hair, beauty)

**industrySecondaryCode** (string) — 6-digit NACE code for precise sub-industry filtering. Use when user asks for very specific industry (e.g., "software development" → "620100", "architects" → "711100", "lawyers" → "691000", "accountants" → "692000", "dentists" → "862300", "GP/doctors" → "862100", "supermarkets" → "471100", "electricians" → "432100", "plumbers" → "432200")

**companyformCode** (string) — Legal entity type:
  "10"=Sole proprietorship (ENK) — one person businesses, freelancers
  "15"=Personal Minor Enterprise (PMV)
  "30"=Partnership (I/S)
  "60"=Public limited company (A/S) — large corporations
  "80"=Private limited company (ApS) — most common SME form
  "110"=Association (Forening)
  "115"=Voluntary association
  "210"=Foreign company branch

**companystatusCode** (string) — Company status:
  ""=All (default)
  "NORMAL"=Active normal
  "AKTIV"=Active
  "OPHØRT"=Dissolved/closed
  "TVANGSOPLØST"=Forcibly dissolved
  "SLETTET"=Deleted

**foundedPeriod** (string) — When company was founded:
  "all"=Any time (default)
  "last30"=Last 30 days
  "last90"=Last 90 days
  "last365"=Last year
  "last3y"=Last 3 years

**region** (string) — Danish region:
  "hovedstaden"=Capital Region (Copenhagen + North Zealand + Bornholm)
  "sjaelland"=Zealand (Roskilde, Køge, Næstved, Holbæk, Slagelse)
  "syddanmark"=Southern Denmark (Odense, Vejle, Kolding, Esbjerg, Sønderborg)
  "midtjylland"=Central Jutland (Aarhus, Herning, Silkeborg, Viborg, Horsens)
  "nordjylland"=Northern Jutland (Aalborg, Frederikshavn, Hjørring, Thisted)

**city** (string) — City name. Must be exact name from this list by region:
${buildCityContext()}

**zipcode** (string) — 4-digit Danish postal code. Use INSTEAD of region when user gives a specific ZIP. Examples:
  1000-2990=Copenhagen area, 3000=Helsingør, 4000=Roskilde, 5000=Odense,
  6000=Kolding, 7000=Fredericia, 7100=Vejle, 8000=Aarhus, 9000=Aalborg

**municipality** (string) — Municipality code (3 digits). Only use if user explicitly mentions a municipality.

**street** (string) — Street name (only if user specifies a street)

**contactPhone** / **contactEmail** / **contactWww** — Contact details (only if explicitly mentioned)

**skipMarketingOptOut** (boolean) — true = exclude companies that have opted out of marketing. Use when user says "contactable", "reachable", "open to marketing"

━━━ PARSING RULES ━━━

1. Industry mapping — be precise:
   - "tech"/"IT"/"software"/"developers" → "62"
   - "construction"/"builders"/"building" → "41"
   - "specialized construction"/"electricians"/"plumbers"/"painters"/"craftsmen" → "43"
   - "retail"/"shops"/"stores" → "47"
   - "wholesale"/"distributors" → "46"
   - "restaurants"/"cafes"/"food service"/"catering" → "56"
   - "consulting"/"consultants"/"advisors" → "70"
   - "real estate"/"property" → "68"
   - "healthcare"/"medical"/"clinics" → "86"
   - "transport"/"logistics"/"haulage"/"trucking" → "49"
   - "marketing"/"advertising"/"PR" → "73"
   - "legal"/"lawyers"/"law firms" → "69"
   - "accounting"/"accountants"/"auditors" → "69"
   - "architecture"/"architects"/"engineers" → "71"
   - "recruitment"/"HR"/"staffing" → "78"
   - "energy"/"utilities"/"power" → "35"
   - "education"/"schools"/"training" → "85"
   - "hotels"/"accommodation" → "55"

2. Company type mapping:
   - "large companies"/"corporations" → companyformCode "60" (A/S)
   - "small businesses"/"SMEs"/"limited" → companyformCode "80" (ApS)
   - "freelancers"/"sole traders"/"self-employed" → companyformCode "10"
   - "associations"/"nonprofits"/"NGOs" → companyformCode "110"

3. Time mapping:
   - "new companies"/"recently founded"/"startups" (no specific time) → "last3y"
   - "last month"/"past month" → "last30"
   - "last quarter"/"past 3 months" → "last90"
   - "last year"/"past year" → "last365"
   - "last 3 years"/"past 3 years" → "last3y"

4. Location mapping:
   - City names: match to exact city from the list above. Danish spellings preferred (København not Copenhagen).
   - "Copenhagen"/"København"/"Kbh" → city="København", region="hovedstaden"
   - Region names in any form: map to region code
   - ZIP codes: set zipcode field directly, also set matching region and city if known

5. Status: default is active companies. Only set status if user explicitly mentions dissolved, closed, deleted, etc.

6. Never guess — omit fields you cannot confidently extract.`;

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json({ error: "Query required" }, { status: 400 });
    }

    // Include zipcode lookup context for any zip mentioned in query
    const zipMatches = query.match(/\b\d{4}\b/g) ?? [];
    const zipContext = zipMatches.length
      ? `\nDetected ZIP codes in query: ${zipMatches.map(z => {
          const match = zipcodeToRegionCity[z];
          return match ? `${z} → ${match.city}, ${match.region}` : `${z} → unknown`;
        }).join("; ")}`
      : "";

    const userMessage = `Parse this search query into CVR filters:
"${query.trim()}"${zipContext}

Return ONLY valid JSON, no markdown:
{
  "filters": { /* only fields that apply */ },
  "reasoning": "One sentence explaining what was extracted and why"
}`;

    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    // Strip markdown code fences if model wraps response
    const cleaned = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as ParseResponse;

    return NextResponse.json({
      filters: parsed.filters || {},
      reasoning: parsed.reasoning || "",
    });
  } catch (error) {
    console.error("Parse search intent error:", error);
    const msg = error instanceof Error ? error.message : "Failed to parse intent";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
