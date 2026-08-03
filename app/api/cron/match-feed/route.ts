import { NextRequest, NextResponse } from "next/server";
import { verifyQStashRequest } from "@/lib/qstash";
import { runMatchFeed } from "@/lib/match-feed/run";

// Cron endpoint: generates the daily match feed for every paid user, at most once
// per UTC day. The generation logic lives in lib/match-feed/run.ts (shared with
// the admin "Run now" action). This route only handles auth + invocation.
// Secured via QStash signature (production) or CRON_SECRET Bearer token (local).
//
// NOTE: the hourly QStash schedule that INVOKES this route must be registered
// out-of-band — there is no schedules.create in this codebase.

export const runtime = "nodejs";
export const maxDuration = 300;

// verbatim from app/api/cron/triggers/route.ts
async function verifyAuth(req: NextRequest): Promise<boolean> {
  // Try QStash signature first (production)
  if (await verifyQStashRequest(req)) return true;
  // Fall back to Bearer token (manual/local testing)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`;
}

// POST: Called by QStash in production
export async function POST(req: NextRequest) {
  if (!(await verifyAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runMatchFeed());
}

// GET: For manual testing / backward compatibility
export async function GET(req: NextRequest) {
  if (!(await verifyAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runMatchFeed());
}
