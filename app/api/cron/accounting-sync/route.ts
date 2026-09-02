import { NextRequest, NextResponse } from "next/server";

import { syncInvoices } from "@/lib/accounting/sync";
import { verifyCronRequest } from "@/lib/cron/verify";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Follow open invoices from draft to paid.
 *
 * The mirror is only as current as its last sync, and nothing pushes to us:
 * booking and payment both happen in the accounting system, so the status of an
 * invoice CVR-MATE created yesterday is unknown until this runs.
 *
 * Terminal statuses (paid, credited, cancelled) are skipped by `syncInvoices`,
 * so the cost is proportional to open invoices rather than to all history.
 *
 * POST mutates. GET is a dry run reporting what would be checked, following
 * `annual-reports` and `contract-renewals`.
 */
export async function POST(req: NextRequest) {
  if (!(await verifyCronRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncInvoices();
    return NextResponse.json({ ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[cron/accounting-sync] Failed:", err);
    return NextResponse.json({ error: "Accounting sync failed" }, { status: 500 });
  }
}
