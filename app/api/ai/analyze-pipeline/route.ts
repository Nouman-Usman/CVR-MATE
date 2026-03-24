import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCompanyByVat } from "@/lib/cvr-api";
import { generateAiJson } from "@/lib/ai";

interface PrioritizedCompany {
  vat: string;
  name: string;
  score: "high" | "medium" | "low";
  reason: string;
}

interface Segment {
  name: string;
  vats: string[];
  insight: string;
}

interface NextAction {
  vat: string;
  name: string;
  action: string;
}

interface PipelineResponse {
  prioritized: PrioritizedCompany[];
  segments: Segment[];
  nextActions: NextAction[];
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { companyVats, locale = "en" } = await req.json();

    if (!Array.isArray(companyVats) || companyVats.length === 0) {
      return NextResponse.json(
        { error: "companyVats array is required" },
        { status: 400 }
      );
    }

    if (companyVats.length > 25) {
      return NextResponse.json(
        { error: "Maximum 25 companies can be analyzed at once" },
        { status: 400 }
      );
    }

    // Fetch all companies in parallel
    const companies = await Promise.all(
      companyVats.map(async (vat: string) => {
        try {
          return await getCompanyByVat(Number(vat));
        } catch {
          return null;
        }
      })
    );

    const validCompanies = companies.filter(Boolean);
    if (validCompanies.length === 0) {
      return NextResponse.json(
        { error: "No valid companies found" },
        { status: 404 }
      );
    }

    const lang = locale === "da" ? "Danish" : "English";

    const companySummaries = validCompanies.map((c) => {
      const acc = c!.accounting?.documents?.[0]?.summary;
      const emp = c!.employment?.years?.[0];
      return `- ${c!.life.name} (CVR: ${c!.vat}) | Industry: ${c!.industry?.primary?.text ?? "?"} | City: ${c!.address?.cityname ?? "?"} | Employees: ${emp?.amount ?? acc?.averagenumberofemployees ?? "?"} | Revenue: ${acc?.revenue != null ? `${acc.revenue} DKK` : "?"} | Profit: ${acc?.profitloss != null ? `${acc.profitloss} DKK` : "?"} | Founded: ${c!.life.start ?? "?"} | Status: ${c!.companystatus?.text ?? "?"} | Bankrupt: ${c!.status?.bankrupt ? "Yes" : "No"}`;
    });

    const systemPrompt = `You are a B2B sales pipeline analyst. You help sales teams prioritize their saved leads. Always respond in ${lang}. Be data-driven and actionable.`;

    const userPrompt = `Analyze this pipeline of ${validCompanies.length} saved companies and provide prioritization:

COMPANIES:
${companySummaries.join("\n")}

Respond with a JSON object:
{
  "prioritized": [
    { "vat": "12345678", "name": "Company Name", "score": "high|medium|low", "reason": "Brief reason for the score (under 80 chars)" }
  ],
  "segments": [
    { "name": "Segment name", "vats": ["12345678", ...], "insight": "What these companies have in common and why it matters" }
  ],
  "nextActions": [
    { "vat": "12345678", "name": "Company Name", "action": "Specific next step to take" }
  ]
}

RULES:
- Score based on: financial health (revenue/profit), growth signals (employee growth), company maturity, and industry attractiveness
- Bankrupt companies = "low" automatically
- Create 2-4 meaningful segments (by industry, size, growth stage, etc.)
- Suggest 1 specific next action per company
- Keep all text concise`;

    const raw = await generateAiJson<Record<string, unknown>>({
      model: "gemini-2.5-flash",
      systemPrompt,
      userPrompt,
      maxTokens: 2048,
    });

    // Normalize key casing
    const result: PipelineResponse = {
      prioritized: (raw.prioritized ?? raw.Prioritized ?? raw.priorities ?? []) as PrioritizedCompany[],
      segments: (raw.segments ?? raw.Segments ?? []) as Segment[],
      nextActions: (raw.nextActions ?? raw.next_actions ?? raw.NextActions ?? []) as NextAction[],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI pipeline analysis error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to analyze pipeline";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
