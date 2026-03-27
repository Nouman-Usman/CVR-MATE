import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCompanyByVat, type CvrCompany } from "@/lib/cvr-api";
import { generateAiJson } from "@/lib/ai";
import { getUserBrand, formatBrandContext } from "@/lib/get-user-brand";
import { checkEntitlement } from "@/lib/stripe/entitlements";

interface TodoSuggestion {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  dueInDays: number;
}

interface SuggestResponse {
  suggestions: TodoSuggestion[];
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed } = await checkEntitlement(session.user.id, "aiFeatures");
    if (!allowed) {
      return NextResponse.json(
        { error: "AI features require a paid plan", upgrade: true },
        { status: 403 }
      );
    }

    const { vat, locale = "en", companyData } = await req.json();

    if (!vat || !/^\d{8}$/.test(String(vat))) {
      return NextResponse.json(
        { error: "Valid 8-digit CVR number is required" },
        { status: 400 }
      );
    }

    // Fetch company data — use client-provided data as fallback
    let company: CvrCompany;
    try {
      company = await getCompanyByVat(Number(vat));
    } catch (err) {
      if (companyData) {
        company = companyData as CvrCompany;
      } else {
        throw err;
      }
    }
    const brand = await getUserBrand(session.user.id);
    const accounting = company.accounting?.documents?.[0]?.summary;
    const participants = company.participants ?? [];
    const emp = company.employment?.years?.[0];

    const lang = locale === "da" ? "Danish" : "English";
    const brandNote = brand ? ` The salesperson works at "${brand.companyName}" and sells: ${brand.products}.` : "";

    const systemPrompt = `You are a B2B sales task planner. You suggest specific, actionable follow-up tasks for a salesperson evaluating a potential lead. Always respond in ${lang}.${brandNote}`;

    const userPrompt = `Suggest 3-5 actionable follow-up tasks for this company:

COMPANY: ${company.life.name} (CVR: ${company.vat})
INDUSTRY: ${company.industry?.primary?.text ?? "Unknown"}
LOCATION: ${company.address?.cityname ?? "Unknown"}
EMPLOYEES: ${emp?.amount ?? accounting?.averagenumberofemployees ?? "Unknown"}
REVENUE: ${accounting?.revenue != null ? `${accounting.revenue} DKK` : "Not available"}
PROFIT/LOSS: ${accounting?.profitloss != null ? `${accounting.profitloss} DKK` : "N/A"}
FOUNDED: ${company.life.start ?? "Unknown"}
BANKRUPT: ${company.status?.bankrupt ? "Yes" : "No"}
WEBSITE: ${company.contact?.www ?? "N/A"}
EMAIL: ${company.contact?.email ?? "N/A"}
PHONE: ${company.contact?.phone ?? "N/A"}

KEY PEOPLE:
${participants.slice(0, 5).map(p => `- ${p.life.name}: ${p.roles?.life?.title ?? p.roles?.type ?? "N/A"}`).join("\n") || "No data"}

Respond with a JSON object:
{
  "suggestions": [
    {
      "title": "Short task title (under 60 chars)",
      "description": "Why this task matters and how to approach it",
      "priority": "high|medium|low",
      "dueInDays": 3
    }
  ]
}

RULES:
- Make tasks specific to THIS company — reference people by name, mention the industry, etc.
- Include a mix of priorities
- Due dates: high priority = 1-3 days, medium = 3-7 days, low = 7-14 days
- Task types: research, outreach, preparation, follow-up
- If contact info is available, suggest using it
- If key people are listed, suggest reaching out to specific individuals

${formatBrandContext(brand)}`;

    const raw = await generateAiJson<Record<string, unknown>>({
      model: "gemini-2.5-flash",
      systemPrompt,
      userPrompt,
      maxTokens: 1024,
    });

    // Normalize — handle key casing variants
    const rawSuggestions = (raw.suggestions ?? raw.Suggestions ?? raw.tasks ?? raw.todos ?? []) as Record<string, unknown>[];
    const result: SuggestResponse = {
      suggestions: rawSuggestions.map((s) => ({
        title: (s.title as string) ?? "",
        description: (s.description as string) ?? "",
        priority: ((s.priority as string) ?? "medium") as "low" | "medium" | "high",
        dueInDays: Number(s.dueInDays ?? s.due_in_days ?? 7),
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI suggest-todos error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to suggest tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
