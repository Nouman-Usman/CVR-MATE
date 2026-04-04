import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { generateAiJson } from "@/lib/ai";
import { getUserBrand } from "@/lib/get-user-brand";
import { checkEntitlement } from "@/lib/stripe/entitlements";

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

    const brand = await getUserBrand(session.user.id);
    if (!brand) {
      return NextResponse.json(
        { error: "Save your company profile first" },
        { status: 400 }
      );
    }

    const { locale = "en" } = await req.json();
    const lang = locale === "da" ? "Danish" : "English";

    const systemPrompt = `You are a B2B brand strategist helping a company build their sales profile. Generate strategic questions that will help you understand their business deeply. Always respond in ${lang}.`;

    const userPrompt = `A company needs to build their brand profile for AI-powered sales intelligence. Here's what we know so far:

COMPANY: ${brand.companyName}
INDUSTRY: ${brand.industry ?? "Not specified"}
PRODUCTS/SERVICES: ${brand.products}
TARGET AUDIENCE: ${brand.targetAudience ?? "Not specified"}
COMPANY SIZE: ${brand.companySize ?? "Not specified"}${brand.employees ? ` (~${brand.employees} employees)` : ""}
WEBSITE: ${brand.website ?? "N/A"}

Generate 5-7 strategic questions to fill the gaps in their profile. Focus on:
- What makes them unique (if products description is vague)
- Their ideal customer (if target audience is vague)
- Pain points they solve
- Competitive positioning
- Geographic focus
- Pricing approach
- Success stories / key results

DON'T ask questions we already have good answers to. If "products" is detailed, skip product questions. If "target audience" is specific, skip audience questions.

Respond with a JSON object:
{
  "questions": [
    { "id": "q1", "question": "...", "placeholder": "hint text for the input field" },
    ...
  ]
}

Each question should be:
- Conversational and friendly (not corporate jargon)
- Specific enough to get useful answers
- Have a helpful placeholder that shows what kind of answer is expected`;

    const raw = await generateAiJson<Record<string, unknown>>({
      model: "gemini-2.5-flash",
      systemPrompt,
      userPrompt,
      maxTokens: 1024,
    });

    // Normalize response
    const topKeys = Object.keys(raw);
    let data = raw;
    if (topKeys.length === 1 && typeof raw[topKeys[0]] === "object" && raw[topKeys[0]] !== null) {
      data = raw[topKeys[0]] as Record<string, unknown>;
    }

    const questions = Array.isArray(data.questions) ? data.questions : Array.isArray(data) ? data : [];

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Brand enrichment questions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate questions" },
      { status: 500 }
    );
  }
}
