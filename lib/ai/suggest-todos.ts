import "server-only";

import { generateAiJson } from "@/lib/ai";
import { accountingSummary, roleLabel, type CvrCompany } from "@/lib/cvr-api";
import { formatBrandContext, type UserBrand } from "@/lib/get-user-brand";

export interface TodoSuggestion {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  dueInDays: number;
}

export interface SuggestTodosResult {
  suggestions: TodoSuggestion[];
}

/** Suggest follow-up tasks for a company. Pure generation (no auth/quota/persist). */
export async function generateTodoSuggestions(params: {
  company: CvrCompany;
  locale: string;
  brand: UserBrand | null | undefined;
}): Promise<SuggestTodosResult> {
  const { company, locale, brand } = params;

  const accounting = accountingSummary(company.accounting?.documents?.[0]);
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
${participants.slice(0, 5).map(p => `- ${p.life.name}: ${roleLabel(p.roles) ?? "N/A"}`).join("\n") || "No data"}

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

  let raw: Record<string, unknown>;
  try {
    raw = await generateAiJson<Record<string, unknown>>({
      model: "claude-haiku-4-5-20251001",
      systemPrompt,
      userPrompt,
      maxTokens: 2048, // Increased from 1024 for thinking model token budget
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("rate limit") || msg.includes("quota")) {
      throw err;
    }
    console.warn("[Suggest Todos] Generation failed, returning empty suggestions:", msg.slice(0, 100));
    raw = { suggestions: [] };
  }

  // Normalize — handle key casing variants
  const rawSuggestions = (raw.suggestions ?? raw.Suggestions ?? raw.tasks ?? raw.todos ?? []) as Record<string, unknown>[];
  const result: SuggestTodosResult = {
    suggestions: rawSuggestions
      .filter((s) => s && typeof s === "object")
      .map((s) => ({
        title: String((s.title as string) ?? "Follow up").trim(),
        description: String((s.description as string) ?? "").trim(),
        priority: ((s.priority as string) ?? "medium") as "low" | "medium" | "high",
        dueInDays: Math.max(1, Number(s.dueInDays ?? s.due_in_days ?? 7)),
      }))
      .filter((s) => s.title.length > 0),
  };

  // Return a sensible default suggestion on failure instead of nothing
  if (result.suggestions.length === 0) {
    result.suggestions = [
      {
        title: "Research this company",
        description: "Gather more context and determine the best approach",
        priority: "medium",
        dueInDays: 3,
      },
    ];
  }

  return result;
}
