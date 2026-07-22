import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { chatLandingSession } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";
import { setTrialOriginCookie } from "@/lib/chat-landing/trial-cookie";
import { notifySlackChatLandingSignup } from "@/lib/slack";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(ip, "chat-landing-signup", 20, 3600, { failClosed: true });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Identity comes from the real session, never from the request body — the client
    // just told us signUp.email() succeeded, it doesn't get to say who it succeeded as.
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const email = session.user.email;

    const body = await req.json();
    const { sessionId } = body as { sessionId?: string };
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const sessionRow = await db.query.chatLandingSession.findFirst({
      where: eq(chatLandingSession.id, sessionId),
    });
    if (!sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    // Only a chat flow that actually reached a recommendation, and hasn't already
    // converted, may mint a trial cookie or fire a signup alert — otherwise this
    // endpoint is a free trial-cookie/Slack-spam generator for any known sessionId.
    if (!sessionRow.recommendedPlan || sessionRow.convertedAt) {
      return NextResponse.json({ error: "Session is not eligible for signup" }, { status: 409 });
    }

    await db
      .update(chatLandingSession)
      .set({
        signupUserId: userId,
        signupEmail: email,
        convertedAt: new Date(),
      })
      .where(eq(chatLandingSession.id, sessionId));

    const response = NextResponse.json({ success: true });
    setTrialOriginCookie(response, sessionId);

    notifySlackChatLandingSignup({
      email,
      transcript: (sessionRow.transcript as { role: "user" | "assistant"; content: string }[]) ?? [],
      qualifyingAnswers: (sessionRow.qualifyingAnswers as Record<string, unknown>) ?? {},
      recommendedPlan: sessionRow.recommendedPlan,
      previewCompanySnapshot: sessionRow.previewCompanySnapshot,
    })
      .then(() => db.update(chatLandingSession).set({ slackNotifiedAt: new Date() }).where(eq(chatLandingSession.id, sessionId)))
      .catch((err) => console.error("chat-landing Slack notify failed:", err));

    return response;
  } catch (error) {
    console.error("chat-landing signup error:", error);
    return NextResponse.json({ error: "Failed to record signup" }, { status: 500 });
  }
}
