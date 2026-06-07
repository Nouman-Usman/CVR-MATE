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

    const userPrompt = `Write a professional cold outreach email to Lars Andersen, CEO of ACME A/S (Danish software consulting company, 45 employees, specialized in enterprise software solutions, CVR 12345678).

Include:
- Subject line (on the first line, prefixed with "Subject: ")
- Professional greeting
- 2-3 sentence opener that references their company/industry
- 1-2 sentence value proposition
- Clear call-to-action
- Professional sign-off

Make it concise but complete. Demonstrate the AI voice settings you've configured.`;

    const message = await generateAiResponse({
      systemPrompt,
      userPrompt,
      maxTokens: 600,
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
