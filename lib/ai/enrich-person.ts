import "server-only";

import { generateAiJson } from "@/lib/ai";
import { formatBrandContext, type UserBrand } from "@/lib/get-user-brand";

export interface PersonEnrichmentResult {
  summary: string;
  roleSignificance: string;
  networkInfluence: Record<string, unknown>;
  careerTrajectory: Record<string, unknown>;
  engagementStrategy: Record<string, unknown>;
  keyInsights: string[];
}

/** Full person (participant) enrichment profile. Pure generation. */
export async function generatePersonEnrichment(params: {
  participantNumber: number | string;
  personName?: string;
  personData?: unknown;
  companies?: unknown;
  locale: string;
  brand: UserBrand | null | undefined;
}): Promise<PersonEnrichmentResult> {
  const { participantNumber, personName, personData, companies, locale, brand } = params;

  const lang = locale === "da" ? "Danish" : "English";

  const brandNote = brand
    ? ` The user sells "${brand.products}"${brand.targetAudience ? ` to ${brand.targetAudience}` : ""}. Consider engagement relevance.`
    : "";

  const systemPrompt = `You are an elite B2B sales intelligence analyst specializing in profiling Danish business professionals. You produce actionable person-level intelligence for sales teams. Always respond in ${lang}. Be specific.${brandNote}`;

  // Build company roles context
  const companiesList = Array.isArray(companies) ? (companies as Record<string, unknown>[]) : [];
  const rolesText = companiesList.length > 0
    ? companiesList.map((c: Record<string, unknown>) => {
        const roles = Array.isArray(c.roles) ? c.roles : [];
        const roleStr = roles.map((r: Record<string, unknown>) => {
          const life = r.life as Record<string, unknown> | undefined;
          return `${r.type}${life?.title ? ` (${life.title})` : ""}${life?.end ? " [ended]" : " [active]"}`;
        }).join(", ");
        return `  - ${(c.life as Record<string, unknown>)?.name ?? "Unknown"} (CVR ${c.vat}): ${roleStr}`;
      }).join("\n")
    : "No company data available";

  const person = (personData ?? {}) as Record<string, unknown>;
  const life = (person.life ?? {}) as Record<string, unknown>;
  const address = (person.address ?? {}) as Record<string, unknown>;

  const userPrompt = `Produce a FULL enrichment profile for this Danish business professional:

PERSON: ${personName ?? life.name ?? "Unknown"}
PARTICIPANT NUMBER: ${participantNumber}
PROFESSION: ${life.profession ?? "Not specified"}
LOCATION: ${[address.cityname, address.countrycode].filter(Boolean).join(", ") || "Unknown"}
DECEASED: ${life.deceased ? "Yes" : "No"}

COMPANY ROLES:
${rolesText}

TOTAL COMPANY CONNECTIONS: ${companiesList.length}
ACTIVE ROLES: ${companiesList.reduce((n: number, c: Record<string, unknown>) => n + (Array.isArray(c.roles) ? c.roles.filter((r: Record<string, unknown>) => !(r.life as Record<string, unknown>)?.end).length : 0), 0)}

Respond with a JSON object containing ALL of these fields:
- "summary": 1-2 paragraph professional overview — who they are, what they do, their significance in the Danish business landscape.
- "roleSignificance": 2-3 sentences explaining what their roles mean for decision-making power and budget authority.
- "networkInfluence": { "score": "high" or "medium" or "low", "details": "2-3 sentences explaining their influence across companies" }
  high = Multiple active senior roles (director, owner, board), large companies
  medium = One or two active roles, or senior role in a small/medium company
  low = Few connections, junior roles, or mostly historical
- "careerTrajectory": { "direction": "rising" or "stable" or "winding_down", "details": "2-3 sentences analyzing their career direction" }
- "engagementStrategy": { "approach": "1-2 sentences on how to reach out", "topics": Array of 3-4 relevant conversation topics, "avoid": "1 sentence on what NOT to discuss" }
- "keyInsights": Array of 3-5 short bullet points — the most important takeaways about this person for a salesperson

${formatBrandContext(brand)}`;

  let raw: Record<string, unknown>;
  try {
    raw = await generateAiJson<Record<string, unknown>>({
      model: "claude-haiku-4-5-20251001",
      systemPrompt,
      userPrompt,
      maxTokens: 6144, // Increased from 3072 for thinking model token budget
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("rate limit") || msg.includes("quota")) {
      throw err;
    }
    console.warn("[Person Enrichment] Generation failed:", msg.slice(0, 100));
    raw = {
      summary: `Analysis of ${personName ?? "this person"} is temporarily unavailable.`,
      roleSignificance: "Pending analysis.",
      networkInfluence: { score: "unknown", details: "Retry enrichment shortly." },
      careerTrajectory: { direction: "unknown", details: "Retry enrichment shortly." },
      engagementStrategy: { approach: "Standard professional approach", topics: [], avoid: "" },
      keyInsights: ["Enrichment data temporarily unavailable."],
    };
  }

  // Flatten nested wrapper
  const topKeys = Object.keys(raw);
  let data = raw;
  if (topKeys.length === 1 && typeof raw[topKeys[0]] === "object" && raw[topKeys[0]] !== null) {
    data = raw[topKeys[0]] as Record<string, unknown>;
  }

  const enrichment: PersonEnrichmentResult = {
    summary: String(data.summary ?? data.Summary ?? "").trim() || "Enrichment pending.",
    roleSignificance: String(data.roleSignificance ?? data.role_significance ?? "").trim() || "Analysis pending.",
    networkInfluence: (data.networkInfluence ?? data.network_influence ?? { score: "medium", details: "Pending analysis" }) as Record<string, unknown>,
    careerTrajectory: (data.careerTrajectory ?? data.career_trajectory ?? { direction: "stable", details: "Pending analysis" }) as Record<string, unknown>,
    engagementStrategy: (data.engagementStrategy ?? data.engagement_strategy ?? { approach: "Standard approach", topics: [], avoid: "" }) as Record<string, unknown>,
    keyInsights: (Array.isArray(data.keyInsights) ? data.keyInsights : Array.isArray(data.key_insights) ? data.key_insights : []) as string[],
  };

  return enrichment;
}
