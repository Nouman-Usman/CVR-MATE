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

    const userPrompt = `Write a complete, professional cold outreach email to Lars Andersen, CEO of ACME A/S (Danish software consulting company, 45 employees, specialized in enterprise software solutions, CVR 12345678).

Structure the email as follows:
- Subject line (on the first line, prefixed with "Subject: ")
- Professional salutation
- Opening paragraph: 2-3 sentences that reference their company, industry, and recent achievements or market position
- Value proposition: 2-3 sentences explaining specific benefits and outcomes relevant to their company size and sector
- Social proof or relevant credentials: 1-2 sentences showing why you/your solution is credible
- Clear call-to-action: specific next step (meeting, call, demo) with proposed timing
- Professional sign-off with title and contact info
- Optional: brief P.S. that adds a touch of personality

Make the email comprehensive, detailed, and fully demonstrate the tone, voice, and writing style you've configured. Focus on quality and personalization over brevity.`;

    const message = await generateAiResponse({
      systemPrompt,
      userPrompt,
      maxTokens: 1500,
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
