import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { generateAiResponse } from "@/lib/ai";
import { getUserBrand, formatBrandContext } from "@/lib/get-user-brand";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 10 previews per minute per user
    const rateLimit = await checkRateLimit(
      session.user.id,
      "voice-preview",
      10,
      60
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limited. Try again in a moment." },
        { status: 429 }
      );
    }

    const brand = await getUserBrand(session.user.id);
    const brandContext = formatBrandContext(brand);

    const systemPrompt = `You are a B2B outreach specialist. Write compelling, personalized cold emails that stand out.
${brandContext}`;

    const userPrompt = `Write a COMPLETE, professional cold outreach email to Lars Andersen, CEO of ACME A/S (Danish software consulting company, 45 employees, specialized in enterprise software solutions, CVR 12345678).

REQUIRED STRUCTURE - INCLUDE ALL SECTIONS:
1. Subject line (first line, prefixed with "Subject: ")
2. Professional salutation (e.g., "Kære Lars Andersen," or "Dear Lars,")
3. Opening paragraph: 2-3 sentences referencing their company, industry, achievements
4. Value proposition: 2-3 sentences on specific benefits and outcomes
5. Social proof: 1-2 sentences on credibility and track record
6. Clear call-to-action: Specific next step with proposed timing
7. Professional sign-off: Name, title, contact info
8. P.S. line: Brief personal touch

CRITICAL: Write the COMPLETE email with all sections fully developed. Do not truncate. End with contact information and P.S.

Fully demonstrate the tone, voice, and writing style configured. Focus on quality and personalization.`;

    const message = await generateAiResponse({
      systemPrompt,
      userPrompt,
      maxTokens: 5000,
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Voice preview failed:", error);
    return NextResponse.json(
      { error: "Preview generation failed" },
      { status: 500 }
    );
  }
}
