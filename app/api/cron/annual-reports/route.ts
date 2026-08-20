import { NextRequest, NextResponse } from "next/server";

import { runAnnualReportPoll } from "@/lib/annual-reports/run";
import { verifyCronRequest } from "@/lib/cron/verify";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Daily annual-report poll for followed companies.
 *
 * POST mutates; GET is a dry run that reports how many companies WOULD be
 * polled and writes nothing — following `contract-renewals`, not `match-feed`
 * (whose GET mutates).
 *
 * Not driven by the CVR change feed: annual reports are filed to the Regnskaber
 * register, and it is unverified whether a filing bumps `change_id`. Polling
 * the followed set is cheaper than that uncertainty.
 *
 * Emits no notifications — S3 establishes the event/state pipeline only. The
 * run returns `notifiable`, which delivery (S5) consumes.
 */
export async function POST(req: NextRequest) {
  if (!(await verifyCronRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAnnualReportPoll();
    return NextResponse.json({ ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Annual-report poll failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Annual-report poll failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  if (!(await verifyCronRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAnnualReportPoll({ dryRun: true });
  return NextResponse.json({ ...result, dryRun: true, timestamp: new Date().toISOString() });
}
