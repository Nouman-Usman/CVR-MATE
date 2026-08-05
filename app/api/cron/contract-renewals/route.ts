import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { contract } from "@/db/schema";
import { verifyQStashRequest } from "@/lib/qstash";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const maxDuration = 300;

// Cron: notify contract owners when an active contract enters its renewal-notice
// window (expiry within renewalNoticeDays, or already overdue). Idempotent —
// `renewalNotifiedAt` is stamped so each contract fires at most once until its
// expiry/notice window is edited (which clears the stamp; see the PATCH route).
// Secured via QStash signature (production) or CRON_SECRET Bearer (local/manual).

// verbatim from app/api/cron/triggers/route.ts
async function verifyAuth(req: NextRequest): Promise<boolean> {
  if (await verifyQStashRequest(req)) return true;
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`;
}

const DAY = 86_400_000;

async function processRenewals() {
  const now = new Date();
  const today = Date.parse(now.toISOString().slice(0, 10));

  // Candidates: active, dated, not yet notified.
  const rows = await db.query.contract.findMany({
    where: and(
      eq(contract.status, "active"),
      isNull(contract.deletedAt),
      isNull(contract.renewalNotifiedAt),
      isNotNull(contract.expiryDate)
    ),
  });

  let notified = 0;
  let skippedNoOwner = 0;

  for (const c of rows) {
    const days = Math.floor((Date.parse(c.expiryDate as string) - today) / DAY);
    if (days > c.renewalNoticeDays) continue; // not in the notice window yet

    // Notify the contract's creator (org-owned data; creator is the accountable user).
    if (!c.createdBy) {
      skippedNoOwner++;
      continue;
    }

    await createNotification({
      userId: c.createdBy,
      type: "system",
      title: `Contract renewal due: ${c.title}`,
      message:
        days < 0
          ? `Expired on ${c.expiryDate} — action needed.`
          : `Expires ${c.expiryDate} (in ${days} day${days === 1 ? "" : "s"}).`,
      link: "/reports",
    });
    await db.update(contract).set({ renewalNotifiedAt: now }).where(eq(contract.id, c.id));
    notified++;
  }

  return { processed: rows.length, notified, skippedNoOwner };
}

export async function POST(req: NextRequest) {
  if (!(await verifyAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await processRenewals());
}

export async function GET(req: NextRequest) {
  if (!(await verifyAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await processRenewals());
}
