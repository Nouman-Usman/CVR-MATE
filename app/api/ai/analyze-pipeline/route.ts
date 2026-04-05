import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCompanyByVat } from "@/lib/cvr-api";
import { generateAiJson } from "@/lib/ai";
import { getUserBrand, formatBrandContext } from "@/lib/get-user-brand";
import { checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";
import { db } from "@/db";
import { company as companyTable } from "@/db/schema";
import { inArray } from "drizzle-orm";

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

    const quota = await checkMonthlyQuota(session.user.id, "ai_usage");
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `AI usage limit reached (${quota.used}/${quota.limit}). Upgrade for more.`, upgrade: true },
        { status: 403 }
      );
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

    const vatStrings = companyVats.map(String);

    // Try fetching from CVR API in parallel, fall back to DB for failures
    const cvrResults = await Promise.allSettled(
      vatStrings.map((vat) => getCompanyByVat(Number(vat)))
    );

    const cvrCompanies = cvrResults
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter(Boolean);

    // For any that failed the CVR API, try the local DB
    const failedVats = vatStrings.filter(
      (_, i) => cvrResults[i].status === "rejected"
    );

    let dbCompanies: { vat: string; name: string; industryName: string | null; city: string | null; employees: number | null; companyStatus: string | null; founded: string | null }[] = [];
    if (failedVats.length > 0) {
      dbCompanies = await db
        .select({
          vat: companyTable.vat,
          name: companyTable.name,
          industryName: companyTable.industryName,
          city: companyTable.city,
          employees: companyTable.employees,
          companyStatus: companyTable.companyStatus,
          founded: companyTable.founded,
        })
        .from(companyTable)
        .where(inArray(companyTable.vat, failedVats));
    }

    // Build company summaries from CVR API data
    const companySummaries: string[] = [];

    for (const c of cvrCompanies) {
      const acc = c!.accounting?.documents?.[0]?.summary;
      const emp = c!.employment?.years?.[0];
      companySummaries.push(
        `- ${c!.life.name} (CVR: ${c!.vat}) | Industry: ${c!.industry?.primary?.text ?? "?"} | City: ${c!.address?.cityname ?? "?"} | Employees: ${emp?.amount ?? acc?.averagenumberofemployees ?? "?"} | Revenue: ${acc?.revenue != null ? `${acc.revenue} DKK` : "?"} | Profit: ${acc?.profitloss != null ? `${acc.profitloss} DKK` : "?"} | Founded: ${c!.life.start ?? "?"} | Status: ${c!.companystatus?.text ?? "?"} | Bankrupt: ${c!.status?.bankrupt ? "Yes" : "No"}`
      );
    }

    // Add DB fallback companies
    for (const c of dbCompanies) {
      companySummaries.push(
        `- ${c.name} (CVR: ${c.vat}) | Industry: ${c.industryName ?? "?"} | City: ${c.city ?? "?"} | Employees: ${c.employees ?? "?"} | Founded: ${c.founded ?? "?"} | Status: ${c.companyStatus ?? "?"}`
      );
    }

    if (companySummaries.length === 0) {
      return NextResponse.json(
        { error: "No valid companies found" },
        { status: 404 }
      );
    }

    console.log(`[AI Pipeline] Analyzing ${companySummaries.length} companies (${cvrCompanies.length} from CVR API, ${dbCompanies.length} from DB)`);

    const lang = locale === "da" ? "Danish" : "English";
    const brand = await getUserBrand(session.user.id);

    const brandNote = brand ? ` The user sells: "${brand.products}"${brand.targetAudience ? ` to ${brand.targetAudience}` : ""}. Factor fit with their offering into scoring.` : "";
    const systemPrompt = `You are a B2B sales pipeline analyst. You help sales teams prioritize their saved leads. Always respond in ${lang}. Be data-driven and actionable.${brandNote}`;

    const userPrompt = `Analyze this pipeline of ${companySummaries.length} saved companies and provide prioritization:

COMPANIES:
${companySummaries.join("\n")}

You MUST respond with a JSON object with exactly these keys: "prioritized", "segments", "nextActions".

Example format:
{
  "prioritized": [
    { "vat": "12345678", "name": "Company Name", "score": "high", "reason": "Brief reason for the score (under 80 chars)" }
  ],
  "segments": [
    { "name": "Segment name", "vats": ["12345678"], "insight": "What these companies have in common and why it matters" }
  ],
  "nextActions": [
    { "vat": "12345678", "name": "Company Name", "action": "Specific next step to take" }
  ]
}

RULES:
- "vat" values MUST be strings, not numbers
- "score" MUST be one of: "high", "medium", "low"
- Include ALL companies in the "prioritized" array
- Score based on: financial health (revenue/profit), growth signals (employee growth), company maturity, industry attractiveness, and fit with the seller's target audience
- Bankrupt companies = "low" automatically
- Create 2-4 meaningful segments (by industry, size, growth stage, etc.)
- Suggest 1 specific next action per company in "nextActions"
- Keep all text concise

${formatBrandContext(brand)}`;

    // Scale token budget with company count to avoid truncation
    const tokenBudget = Math.min(8192, 1536 + companySummaries.length * 200);

    const raw = await generateAiJson<Record<string, unknown>>({
      model: "gemini-2.5-flash",
      systemPrompt,
      userPrompt,
      maxTokens: tokenBudget,
    });

    // Normalize key casing — AI models sometimes vary casing
    const rawPrioritized = (raw.prioritized ?? raw.Prioritized ?? raw.priorities ?? []) as PrioritizedCompany[];
    const rawSegments = (raw.segments ?? raw.Segments ?? []) as Segment[];
    const rawNextActions = (raw.nextActions ?? raw.next_actions ?? raw.NextActions ?? []) as NextAction[];

    // Sanitize — ensure score values are valid, coerce vat to string
    const validScores = new Set(["high", "medium", "low"]);
    const result: PipelineResponse = {
      prioritized: rawPrioritized.map(p => ({
        vat: String(p.vat),
        name: p.name ?? "",
        score: (validScores.has(p.score) ? p.score : "medium") as "high" | "medium" | "low",
        reason: p.reason ?? "",
      })),
      segments: rawSegments.map(s => ({
        name: s.name ?? "",
        vats: Array.isArray(s.vats) ? s.vats.map(String) : [],
        insight: s.insight ?? "",
      })),
      nextActions: rawNextActions.map(na => ({
        vat: String(na.vat),
        name: na.name ?? "",
        action: na.action ?? "",
      })),
    };

    console.log(`[AI Pipeline] Done — ${result.prioritized.length} prioritized, ${result.segments.length} segments, ${result.nextActions.length} actions`);

    await recordUsage(session.user.id, "ai_usage");
    return NextResponse.json(result);
  } catch (error) {
    console.error("AI pipeline analysis error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to analyze pipeline";
    const status = message.includes("rate limit") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
