import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { generateAiResponse } from "@/lib/ai";
import { getUserBrand, formatBrandContext } from "@/lib/get-user-brand";

export const maxDuration = 30;

export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const brand = await getUserBrand(session.user.id);
    const brandContext = formatBrandContext(brand);

    const systemPrompt = `You are a B2B outreach specialist. Write short, personalized cold emails.
${brandContext}`;

    const userPrompt = `Write a 3-sentence cold outreach email to Lars Andersen, CEO of ACME A/S (Danish software company, 45 employees, CVR 12345678). The email should demonstrate your AI voice settings. Output only the email body — no subject line, no sign-off.`;

    const message = await generateAiResponse({
      systemPrompt,
      userPrompt,
      maxTokens: 200,
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Voice preview failed:", error);
    return NextResponse.json({ error: "Preview generation failed" }, { status: 500 });
  }
}
