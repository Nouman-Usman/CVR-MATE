import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { validateActiveOrg } from "@/lib/team/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { reserveMonthlyQuota } from "@/lib/stripe/entitlements";
import { getUserBrand, formatBrandContext } from "@/lib/get-user-brand";
import { createSession, getSessionRow } from "@/lib/agent/persistence";
import { runAgentTurn, resumeAfterConfirm } from "@/lib/agent/runtime";
import { encodeEvent, SSE_HEADERS } from "@/lib/agent/stream";
import type { AgentContext, AgentLocale, EmitFn, StreamEvent } from "@/lib/agent/types";

export const maxDuration = 60;

function deriveTitle(message: string): string {
  const t = message.trim().replace(/\s+/g, " ");
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}

/** Wrap an async runner that emits StreamEvents into an SSE-framed ReadableStream. */
function makeStream(run: (emit: EmitFn) => Promise<void>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit: EmitFn = (event: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encodeEvent(event));
        } catch {
          closed = true;
        }
      };
      try {
        await run(emit);
      } catch (e) {
        emit({ type: "error", message: e instanceof Error ? e.message : "Agent error" });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const rl = await checkRateLimit(userId, "agent_turn", 20, 60, { failClosed: true });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Maximum 20 agent turns per minute." },
      { status: 429 }
    );
  }

  const organizationId = await validateActiveOrg(userId, session.session?.activeOrganizationId);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = (raw ?? {}) as Record<string, unknown>;

  const locale: AgentLocale = body.locale === "en" ? "en" : "da";
  const brand = await getUserBrand(userId);
  const ctx: AgentContext = { userId, organizationId, locale, brandContext: formatBrandContext(brand) };

  // ── Confirm / resume path ──────────────────────────────────────────────────
  const confirm = body.confirm as { toolUseId?: unknown; approved?: unknown } | undefined;
  if (confirm && typeof confirm === "object") {
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const toolUseId = typeof confirm.toolUseId === "string" ? confirm.toolUseId : "";
    const approved = confirm.approved === true;
    if (!sessionId || !toolUseId) {
      return NextResponse.json({ error: "sessionId and confirm.toolUseId are required" }, { status: 400 });
    }
    const row = await getSessionRow(sessionId);
    if (!row || row.userId !== userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const resumeCtx: AgentContext = { ...ctx, locale: row.locale };
    const stream = makeStream((emit) => resumeAfterConfirm({ sessionId, ctx: resumeCtx, emit, toolUseId, approved }));
    return new Response(stream, { headers: SSE_HEADERS });
  }

  // ── New user turn ────────────────────────────────────────────────────────
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // One turn = one ai_usage unit (per-tool features are metered inside the tools).
  const quota = await reserveMonthlyQuota(userId, "ai_usage");
  if (!quota.allowed) {
    return NextResponse.json(
      { error: `AI usage limit reached (${quota.used}/${quota.limit}). Upgrade for more.`, upgrade: true },
      { status: 403 }
    );
  }

  let sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  let isNew = false;
  if (sessionId) {
    const row = await getSessionRow(sessionId);
    if (!row || row.userId !== userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
  } else {
    sessionId = await createSession({ userId, organizationId, locale, title: deriveTitle(message) });
    isNew = true;
  }

  const finalSessionId = sessionId;
  const stream = makeStream(async (emit) => {
    if (isNew) emit({ type: "session", sessionId: finalSessionId });
    await runAgentTurn({ sessionId: finalSessionId, userMessage: message, ctx, emit });
  });
  return new Response(stream, { headers: SSE_HEADERS });
}
