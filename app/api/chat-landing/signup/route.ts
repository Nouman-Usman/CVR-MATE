import { NextRequest, NextResponse } from "next/server";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { chatLandingSession } from "@/db/schema";
import { and, eq, ne, or, isNotNull } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";
import { setTrialOriginCookie } from "@/lib/chat-landing/trial-cookie";
import { notifySlackChatLandingSignup } from "@/lib/slack";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Tight limit — this is a conversion/account-creation endpoint, not a chat
    // turn. A handful of attempts per IP per hour covers a genuine signup + retries.
    const rateLimit = await checkRateLimit(ip, "chat-landing-signup", 5, 3600, { failClosed: true });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { sessionId, name, email, password } = body as {
      sessionId?: string;
      name?: string;
      email?: string;
      password?: string;
    };
    if (!sessionId || !name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sessionRow = await db.query.chatLandingSession.findFirst({
      where: eq(chatLandingSession.id, sessionId),
    });
    if (!sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    // The chat must have actually reached a recommendation, and each chat session
    // converts exactly once — this stops the endpoint being replayed to mint extra
    // trial cookies / Slack alerts for a known sessionId.
    if (!sessionRow.recommendedPlan) {
      return NextResponse.json({ error: "Session is not eligible for signup" }, { status: 409 });
    }
    if (sessionRow.convertedAt) {
      return NextResponse.json(
        { error: "This chat session has already been used to start a trial." },
        { status: 409 }
      );
    }

    // One trial per email and per network. `email` here is only a lookup key for
    // prior conversions, not an identity claim — the authoritative identity comes
    // from the account we create below.
    const normalizedEmail = email.trim().toLowerCase();
    const ipKnown = ip && ip !== "unknown";
    const dupMatch = ipKnown
      ? or(eq(chatLandingSession.signupEmail, normalizedEmail), eq(chatLandingSession.ipAddress, ip))
      : eq(chatLandingSession.signupEmail, normalizedEmail);
    const priorConversion = await db.query.chatLandingSession.findFirst({
      where: and(
        ne(chatLandingSession.id, sessionId),
        isNotNull(chatLandingSession.convertedAt),
        dupMatch
      ),
      columns: { id: true },
    });
    if (priorConversion) {
      return NextResponse.json(
        { error: "A free trial has already been started from this email or network." },
        { status: 409 }
      );
    }

    // Create the account server-side. Identity is whatever better-auth actually
    // created — the request body cannot claim to be an existing user. Email
    // verification is required (lib/auth.ts), so this sends the verification
    // email and does NOT return a usable session, which is fine: we only need
    // the new user's id to bind the trial.
    let createdUser: { id: string; email: string };
    try {
      const result = await auth.api.signUpEmail({
        body: { name, email: normalizedEmail, password },
      });
      createdUser = { id: result.user.id, email: result.user.email };
    } catch (err) {
      if (err instanceof APIError) {
        // e.g. email already registered, password too short — surface the reason.
        const message =
          (err.body?.message as string | undefined) ?? "Could not create your account.";
        return NextResponse.json({ error: message }, { status: 400 });
      }
      throw err;
    }

    await db
      .update(chatLandingSession)
      .set({
        signupUserId: createdUser.id,
        signupEmail: createdUser.email,
        convertedAt: new Date(),
      })
      .where(eq(chatLandingSession.id, sessionId));

    const response = NextResponse.json({ success: true });
    setTrialOriginCookie(response, sessionId);

    notifySlackChatLandingSignup({
      email: createdUser.email,
      transcript: (sessionRow.transcript as { role: "user" | "assistant"; content: string }[]) ?? [],
      qualifyingAnswers: (sessionRow.qualifyingAnswers as Record<string, unknown>) ?? {},
      recommendedPlan: sessionRow.recommendedPlan,
      previewCompanySnapshot: sessionRow.previewCompanySnapshot,
      ip: sessionRow.ipAddress ?? ip,
    })
      .then(() => db.update(chatLandingSession).set({ slackNotifiedAt: new Date() }).where(eq(chatLandingSession.id, sessionId)))
      .catch((err) => console.error("chat-landing Slack notify failed:", err));

    return response;
  } catch (error) {
    console.error("chat-landing signup error:", error);
    return NextResponse.json({ error: "Failed to record signup" }, { status: 500 });
  }
}
