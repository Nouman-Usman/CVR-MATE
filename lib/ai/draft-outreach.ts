import "server-only";

import { generateAiJson } from "@/lib/ai";
import { accountingSummary, hasRoleMatching, roleLabel, type CvrCompany } from "@/lib/cvr-api";
import { formatBrandContext, type UserBrand } from "@/lib/get-user-brand";

export interface OutreachResult {
  subject?: string;
  message: string;
  followUp: string;
}

/**
 * Generate a cold outreach message (email / LinkedIn / phone script). Pure
 * generation — the caller resolves `tone`/`sellingPoint` defaults from brand,
 * handles auth/quota, and persists. Shared by /api/ai/draft-outreach and the
 * agent's `draft_outreach` tool.
 */
export async function generateOutreach(params: {
  company: CvrCompany;
  type: string;
  tone: string;
  sellingPoint: string;
  targetRole?: string;
  locale: string;
  brand: UserBrand | null | undefined;
}): Promise<OutreachResult> {
  const { company, type, tone, sellingPoint, targetRole, locale, brand } = params;

  const accounting = accountingSummary(company.accounting?.documents?.[0]);
  const participants = company.participants ?? [];

  // Find target person if specified
  let targetPerson = "";
  if (targetRole && participants.length > 0) {
    const match = participants.find(
      (p) =>
        hasRoleMatching(p.roles, targetRole) ||
        p.life.name.toLowerCase().includes(targetRole.toLowerCase())
    );
    if (match) {
      targetPerson = `Address the message to: ${match.life.name} (${roleLabel(match.roles) ?? "Contact"})`;
    }
  }

  const lang = locale === "da" ? "Danish" : "English";
  const messageTypes: Record<string, string> = {
    email: "cold email (include subject line)",
    linkedin: "LinkedIn connection message (keep under 300 characters for the main message)",
    phone_script: "phone call script with opening, key points, and closing",
  };

  const systemPrompt = `You are an expert B2B sales copywriter specializing in Danish market outreach. Write compelling, personalized messages that feel researched and genuine — never generic. Always write in ${lang}. Adapt the formality based on the tone parameter.`;

  const userPrompt = `Write a ${tone} ${messageTypes[type] ?? "email"} for this company:

COMPANY: ${company.life.name}
INDUSTRY: ${company.industry?.primary?.text ?? "Unknown"}
LOCATION: ${company.address?.cityname ?? "Denmark"}
EMPLOYEES: ${accounting?.averagenumberofemployees ?? "Unknown"}
REVENUE: ${accounting?.revenue != null ? `${accounting.revenue} DKK` : "Not disclosed"}
FOUNDED: ${company.life.start ?? "Unknown"}
PURPOSE: ${company.info?.purpose ?? "Not stated"}
${targetPerson}

KEY PEOPLE:
${participants.slice(0, 5).map(p => `- ${p.life.name}: ${roleLabel(p.roles) ?? "N/A"}`).join("\n") || "Not available"}

${sellingPoint ? `WHAT I'M SELLING: ${sellingPoint}` : ""}

${formatBrandContext(brand)}

RULES:
- Reference specific company details (industry, size, location) to show you've done research
- If addressing a specific person, use their name naturally
- Keep the ${type === "linkedin" ? "message very concise" : "message focused and scannable"}
- Include a clear call-to-action
- Don't be pushy or use clichés like "I hope this email finds you well"
- ${tone === "casual" ? "Use a friendly, conversational tone" : "Maintain professional language"}

Respond with a JSON object:
{
  ${type === "email" ? '"subject": "Email subject line",' : ""}
  "message": "The ${type === "phone_script" ? "phone script" : "message"} body",
  "followUp": "A shorter follow-up message to send 3-5 days later if no response"
}`;

  let raw: Record<string, unknown>;
  try {
    raw = await generateAiJson<Record<string, unknown>>({
      model: "claude-haiku-4-5-20251001",
      systemPrompt,
      userPrompt,
      maxTokens: 4096,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("rate limit") || msg.includes("quota")) {
      throw err;
    }
    // Fallback message on failure
    const fallbackMessage = type === "email"
      ? "Unable to generate personalized message at this moment. Please try again."
      : "Unable to generate personalized phone script at this moment. Please try again.";
    raw = {
      subject: type === "email" ? `Let's connect` : undefined,
      message: fallbackMessage,
      followUp: "Checking in again",
    };
  }

  // The model sometimes wraps the response inside a single top-level key
  const rawKeys = Object.keys(raw);
  if (rawKeys.length === 1 && typeof raw[rawKeys[0]] === "object" && raw[rawKeys[0]] !== null) {
    raw = raw[rawKeys[0]] as Record<string, unknown>;
  }

  // Flatten any nested objects into the raw object for key lookup
  for (const [, rv] of Object.entries(raw)) {
    if (rv != null && typeof rv === "object" && !Array.isArray(rv)) {
      for (const [nk, nv] of Object.entries(rv as Record<string, unknown>)) {
        if (typeof nv === "string" && !(nk in raw)) {
          raw[nk] = nv;
        }
      }
    }
  }

  // Find a string value by checking multiple possible key names (case-insensitive)
  const get = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      if (raw[k] != null && typeof raw[k] === "string") return raw[k] as string;
    }
    for (const [rk, rv] of Object.entries(raw)) {
      if (rv != null && typeof rv === "string") {
        const lower = rk.toLowerCase().replace(/[_\s-]/g, "");
        for (const k of keys) {
          if (lower === k.toLowerCase().replace(/[_\s-]/g, "")) return rv;
          if (lower.includes(k.toLowerCase().replace(/[_\s-]/g, ""))) return rv;
        }
      }
    }
    return "";
  };

  const normalized: OutreachResult = {
    subject: get("subject", "email_subject", "emailSubject", "subjectLine", "subject_line") || undefined,
    message: get("message", "body", "content", "text", "email", "emailBody", "email_body") || "",
    followUp: get("followUp", "follow_up", "followup", "followUpMessage", "follow_up_message") || "",
  };

  return normalized;
}
