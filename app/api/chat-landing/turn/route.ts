import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chatLandingSession } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";
import { generateAiJson } from "@/lib/ai";
import { CHAT_LANDING_SYSTEM_PROMPT, buildChatTurnPrompt, type ChatTurnResult } from "@/lib/chat-landing/prompts";
import { recommendPlan, type QualifyingAnswers } from "@/lib/chat-landing/plan-recommendation";
import { searchCompanies } from "@/lib/cvr-api";
import { maskCompanyForPreview } from "@/lib/chat-landing/masking";

interface TranscriptTurn {
  role: "user" | "assistant";
  content: string;
}

const MAX_USER_TURNS = 5;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(ip, "chat-landing-turn", 20, 3600, { failClosed: true });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const { sessionId, transcript } = body as { sessionId?: string; transcript?: TranscriptTurn[] };

    if (!sessionId || typeof sessionId !== "string" || !Array.isArray(transcript)) {
      return NextResponse.json({ error: "sessionId and transcript are required" }, { status: 400 });
    }

    const sessionRow = await db.query.chatLandingSession.findFirst({
      where: eq(chatLandingSession.id, sessionId),
    });
    if (!sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const userTurnCount = transcript.filter((t) => t.role === "user").length;

    const userPrompt = buildChatTurnPrompt(transcript);
    const aiResult = await generateAiJson<ChatTurnResult>({
      systemPrompt: CHAT_LANDING_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 512,
    });

    const forceReady = userTurnCount >= MAX_USER_TURNS;
    const readyToRecommend = forceReady || aiResult.readyToRecommend;

    const existingAnswers = (sessionRow.qualifyingAnswers as QualifyingAnswers) ?? {};
    const mergedAnswers: QualifyingAnswers = { ...existingAnswers, ...aiResult.extractedFields };

    const updatedTranscript: TranscriptTurn[] = [
      ...transcript,
      { role: "assistant", content: aiResult.assistantMessage },
    ];

    let recommendedPlan: string | null = null;
    let maskedPreview: ReturnType<typeof maskCompanyForPreview>[] = [];

    if (readyToRecommend) {
      recommendedPlan = recommendPlan(mergedAnswers);

      const industryHint = mergedAnswers.useCase;
      const companies = await searchCompanies({
        limit: "5",
        ...(industryHint ? { industry_primary_text: industryHint } : {}),
      });
      maskedPreview = companies.slice(0, 5).map(maskCompanyForPreview);

      await db
        .update(chatLandingSession)
        .set({
          transcript: updatedTranscript,
          qualifyingAnswers: mergedAnswers,
          recommendedPlan,
          previewCompanyVats: companies.map((c) => c.vat),
          previewCompanySnapshot: companies,
        })
        .where(eq(chatLandingSession.id, sessionId));
    } else {
      await db
        .update(chatLandingSession)
        .set({
          transcript: updatedTranscript,
          qualifyingAnswers: mergedAnswers,
        })
        .where(eq(chatLandingSession.id, sessionId));
    }

    return NextResponse.json({
      assistantMessage: aiResult.assistantMessage,
      // Tappable answers for the next turn — suppressed once we recommend,
      // since the recommendation UI takes over the conversation from here.
      suggestedReplies: readyToRecommend ? [] : (aiResult.suggestedReplies ?? []).slice(0, 3),
      readyToRecommend,
      recommendedPlan,
      preview: maskedPreview,
    });
  } catch (error) {
    console.error("chat-landing turn error:", error);
    const message = error instanceof Error ? error.message : "Failed to process chat turn";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
