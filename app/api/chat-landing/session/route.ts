import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chatLandingSession } from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const rateLimit = await checkRateLimit(ip, "chat-landing-session", 20, 3600, { failClosed: true });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const userAgent = req.headers.get("user-agent") ?? null;
    const body = await req.json().catch(() => ({}));
    const locale: "da" | "en" = body?.locale === "en" ? "en" : "da";

    const [row] = await db
      .insert(chatLandingSession)
      .values({ ipAddress: ip, userAgent, locale })
      .returning({ id: chatLandingSession.id });

    return NextResponse.json({ sessionId: row.id });
  } catch (error) {
    console.error("chat-landing session create error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
