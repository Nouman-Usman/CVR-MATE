import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { SearchFiltersState } from "@/lib/stores/search-store";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ParseResponse {
  filters: Partial<SearchFiltersState>;
  reasoning: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query required" },
        { status: 400 }
      );
    }

    const prompt = `You are an expert at parsing search intent for a Danish company registry (CVR).

Users describe what companies they want to find in plain English or Danish. Extract search filters from their request.

Available filter fields (all optional):
- query: company name or keyword (string)
- industryCode: NACE code 2-digit (string, e.g., "62" for IT)
- industrySecondaryCode: secondary NACE code 6-digit (string)
- companyformCode: company form code (string: "10"=sole prop, "60"=A/S, "80"=ApS, etc.)
- companystatusCode: status (string: "NORMAL", "AKTIV", "OPHØRT", "TVANGSOPLØST", "SLETTET")
- foundedPeriod: founding date range (string: "all", "last30", "last90", "last365", "last3y")
- city: city name (string)
- region: region (string: "hovedstaden", "midtjylland", "syddanmark", "nordjylland", "sjaelland")
- zipcode: postal code (string, 4 digits)
- municipality: municipality code (string, 1-3 digits)
- street: street name (string)
- numberFrom: street number (string)
- contactPhone: phone number (string)
- contactEmail: email address (string)
- contactWww: website (string)
- skipMarketingOptOut: exclude marketing opt-out (boolean)

User request: "${query.trim()}"

Return ONLY valid JSON (no markdown, no explanation):
{
  "filters": { /* populated fields only */ },
  "reasoning": "Brief explanation of what was extracted"
}

IMPORTANT:
- Return ONLY the JSON object, nothing else
- Only include filter fields that were mentioned or clearly implied
- For industry, try to map common terms (e.g., "tech" → "62", "construction" → "41-42", "retail" → "47")
- For founded periods, map: "last X days/weeks/months" → closest period
- Keep reasoning under 100 words
- If you cannot determine a filter, omit it from the result`;

    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";
    const parsed = JSON.parse(responseText) as ParseResponse;

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
