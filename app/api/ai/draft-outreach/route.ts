import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCompanyByVat } from "@/lib/cvr-api";
import { generateAiJson } from "@/lib/ai";
import { getUserBrand, formatBrandContext } from "@/lib/get-user-brand";
import { db } from "@/db";
import { outreachMessage } from "@/db/schema";

interface OutreachResponse {
  subject?: string;
  message: string;
  followUp: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      vat,
      type = "email",
      tone: requestTone,
      sellingPoint: requestSellingPoint,
      targetRole,
      locale = "en",
    } = await req.json();

    if (!vat || !/^\d{8}$/.test(String(vat))) {
      return NextResponse.json(
        { error: "Valid 8-digit CVR number is required" },
        { status: 400 }
      );
    }

    // Use brand data as defaults for sellingPoint and tone
    const brand = await getUserBrand(session.user.id);
    const sellingPoint = requestSellingPoint || brand?.products || "";
    const tone = requestTone || brand?.tone || "formal";

    const company = await getCompanyByVat(Number(vat));
    const accounting = company.accounting?.documents?.[0]?.summary;
    const participants = company.participants ?? [];

    // Find target person if specified
    let targetPerson = "";
    if (targetRole && participants.length > 0) {
      const match = participants.find(
        (p) =>
          p.roles?.life?.title?.toLowerCase().includes(targetRole.toLowerCase()) ||
          p.life.name.toLowerCase().includes(targetRole.toLowerCase())
      );
      if (match) {
        targetPerson = `Address the message to: ${match.life.name} (${match.roles?.life?.title ?? match.roles?.type ?? "Contact"})`;
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
${participants.slice(0, 5).map(p => `- ${p.life.name}: ${p.roles?.life?.title ?? p.roles?.type ?? "N/A"}`).join("\n") || "Not available"}

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

    let raw = await generateAiJson<Record<string, unknown>>({
      model: "gemini-2.5-flash",
      systemPrompt,
      userPrompt,
      maxTokens: 2048,
    });

    // Gemini sometimes wraps the response inside a single top-level key
    const rawKeys = Object.keys(raw);
    if (rawKeys.length === 1 && typeof raw[rawKeys[0]] === "object" && raw[rawKeys[0]] !== null) {
      raw = raw[rawKeys[0]] as Record<string, unknown>;
    }

    // Flatten any nested objects into the raw object for key lookup
    for (const [rk, rv] of Object.entries(raw)) {
      if (rv != null && typeof rv === "object" && !Array.isArray(rv)) {
        for (const [nk, nv] of Object.entries(rv as Record<string, unknown>)) {
          if (typeof nv === "string" && !(nk in raw)) {
            raw[nk] = nv;
          }
        }
      }
    }

    // Find a string value by checking multiple possible key names (case-insensitive)
    const get = (...keys: string[]): string => {
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

    const normalized: OutreachResponse = {
      subject: get("subject", "email_subject", "emailSubject", "subjectLine", "subject_line") || undefined,
      message: get("message", "body", "content", "text", "email", "emailBody", "email_body"),
      followUp: get("followUp", "follow_up", "followup", "followUpMessage", "follow_up_message"),
    };

    if (!normalized.message) {
      return NextResponse.json({ error: "AI returned empty message" }, { status: 500 });
    }

    // Persist to database
    const [saved] = await db
      .insert(outreachMessage)
      .values({
        userId: session.user.id,
        companyVat: String(vat),
        companyName: company.life.name,
        type,
        tone,
        subject: normalized.subject || null,
        message: normalized.message,
        followUp: normalized.followUp || "",
      })
      .returning();

    return NextResponse.json({ ...normalized, id: saved.id });
  } catch (error) {
    console.error("AI outreach error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate outreach";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
