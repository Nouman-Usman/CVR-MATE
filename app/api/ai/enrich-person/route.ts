import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { generateAiJson } from "@/lib/ai";
import { getUserBrand, formatBrandContext } from "@/lib/get-user-brand";
import { checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";
import { db } from "@/db";
import { profileEnrichment } from "@/db/schema";
import { cacheSet } from "@/lib/redis";
import { cacheKey, CACHE_TTL } from "@/lib/cache";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quota = await checkMonthlyQuota(session.user.id, "enrichment");
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `AI usage limit reached (${quota.used}/${quota.limit}). Upgrade for more.`, upgrade: true },
        { status: 403 }
      );
    }

    const { participantNumber, personName, locale = "en", personData, companies } = await req.json();

    if (!participantNumber) {
      return NextResponse.json({ error: "participantNumber is required" }, { status: 400 });
    }

    const brand = await getUserBrand(session.user.id);
    const lang = locale === "da" ? "Danish" : "English";

    const brandNote = brand
      ? ` The user sells "${brand.products}"${brand.targetAudience ? ` to ${brand.targetAudience}` : ""}. Consider engagement relevance.`
      : "";

    const systemPrompt = `You are an elite B2B sales intelligence analyst specializing in profiling Danish business professionals. You produce actionable person-level intelligence for sales teams. Always respond in ${lang}. Be specific.${brandNote}`;

    // Build company roles context
    const companiesList = Array.isArray(companies) ? companies : [];
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

    const person = personData ?? {};
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

    const raw = await generateAiJson<Record<string, unknown>>({
      model: "gemini-2.5-flash",
      systemPrompt,
      userPrompt,
      maxTokens: 3072,
    });

    // Flatten nested wrapper
    const topKeys = Object.keys(raw);
    let data = raw;
    if (topKeys.length === 1 && typeof raw[topKeys[0]] === "object" && raw[topKeys[0]] !== null) {
      data = raw[topKeys[0]] as Record<string, unknown>;
    }

    const enrichment = {
      summary: String(data.summary ?? data.Summary ?? ""),
      roleSignificance: String(data.roleSignificance ?? data.role_significance ?? ""),
      networkInfluence: (data.networkInfluence ?? data.network_influence ?? { score: "medium", details: "" }) as Record<string, unknown>,
      careerTrajectory: (data.careerTrajectory ?? data.career_trajectory ?? { direction: "stable", details: "" }) as Record<string, unknown>,
      engagementStrategy: (data.engagementStrategy ?? data.engagement_strategy ?? { approach: "", topics: [], avoid: "" }) as Record<string, unknown>,
      keyInsights: (Array.isArray(data.keyInsights) ? data.keyInsights : Array.isArray(data.key_insights) ? data.key_insights : []) as string[],
    };

    if (!enrichment.summary) {
      return NextResponse.json({ error: "AI returned empty enrichment" }, { status: 500 });
    }

    // Persist to Postgres
    const [saved] = await db
      .insert(profileEnrichment)
      .values({
        userId: session.user.id,
        entityType: "person",
        entityId: String(participantNumber),
        entityName: personName ?? String(life.name ?? "Unknown"),
        enrichmentData: enrichment,
      })
      .returning();

    // Cache in Redis (24h)
    const rKey = cacheKey.enrichment("person", String(participantNumber), session.user.id);
    await cacheSet(rKey, { ...enrichment, id: saved.id, createdAt: saved.createdAt.toISOString() }, CACHE_TTL.enrichment);

    await recordUsage(session.user.id, "enrichment");

    return NextResponse.json({
      enrichment: { ...enrichment, id: saved.id, createdAt: saved.createdAt.toISOString() },
    });
  } catch (error) {
    console.error("Person enrichment error:", error instanceof Error ? error.stack : error);
    const message = error instanceof Error ? error.message : "Failed to generate enrichment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
