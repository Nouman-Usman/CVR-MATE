import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNull, isNotNull, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { contract } from "@/db/schema";
import { member } from "@/db/auth-schema";
import { verifyCronRequest } from "@/lib/cron/verify";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron: notify contract owners when an active contract enters its renewal-notice
 * window (expiry within `renewalNoticeDays`, or already overdue).
 *
 * Three properties this has to hold, each of which it previously did not:
 *
 * 1. **Bounded.** The notice window is evaluated in SQL, so a contract expiring
 *    in three years is never fetched. Previously every dated active contract in
 *    every organization was loaded into memory on every run and filtered in JS.
 *
 * 2. **Idempotent under retry.** The stamp is *claimed* before the notification
 *    is sent, with `renewal_notified_at IS NULL` in the WHERE clause. Previously
 *    the notification was inserted first and the stamp written after with no
 *    guard, so a QStash retry, an overlapping run, or a crash between the two
 *    statements produced duplicate notifications.
 *
 * 3. **Deliverable.** `contract.createdBy` is ON DELETE SET NULL, so contracts
 *    outlive their creator. Those used to be silently skipped forever; now they
 *    fall back to the organization's owners and admins.
 */

const BATCH_SIZE = 200;

interface RenewalRun {
  scanned: number;
  notified: number;
  claimedByOther: number;
  undeliverable: number;
  dryRun: boolean;
}

/** Owners/admins of an org, for contracts whose creator is gone. */
async function orgFallbackRecipients(organizationId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: member.userId })
    .from(member)
    .where(
      and(
        eq(member.organizationId, organizationId),
        inArray(member.role, ["owner", "admin"])
      )
    );
  return rows.map((r) => r.userId);
}

async function processRenewals(dryRun: boolean): Promise<RenewalRun> {
  const now = new Date();
  const run: RenewalRun = {
    scanned: 0,
    notified: 0,
    claimedByOther: 0,
    undeliverable: 0,
    dryRun,
  };

  // The window lives in SQL: `expiry_date <= current_date + renewal_notice_days`
  // (Postgres date + integer yields a date), which also covers already-overdue
  // contracts. Paged so one huge org cannot blow the function's memory or time.
  for (let page = 0; ; page++) {
    const due = await db
      .select({
        id: contract.id,
        title: contract.title,
        expiryDate: contract.expiryDate,
        createdBy: contract.createdBy,
        organizationId: contract.organizationId,
      })
      .from(contract)
      .where(
        and(
          eq(contract.status, "active"),
          isNull(contract.deletedAt),
          isNull(contract.renewalNotifiedAt),
          isNotNull(contract.expiryDate),
          sql`${contract.expiryDate} <= current_date + ${contract.renewalNoticeDays}`
        )
      )
      .orderBy(asc(contract.expiryDate))
      .limit(BATCH_SIZE);

    if (due.length === 0) break;
    run.scanned += due.length;

    for (const c of due) {
      if (dryRun) continue;

      // Claim first. Whoever wins this update owns sending the notification;
      // a concurrent run finds zero rows and moves on.
      const [claimed] = await db
        .update(contract)
        .set({ renewalNotifiedAt: now })
        .where(and(eq(contract.id, c.id), isNull(contract.renewalNotifiedAt)))
        .returning({ id: contract.id });

      if (!claimed) {
        run.claimedByOther++;
        continue;
      }

      const recipients = c.createdBy
        ? [c.createdBy]
        : await orgFallbackRecipients(c.organizationId);

      if (recipients.length === 0) {
        run.undeliverable++;
        continue;
      }

      const daysLeft = c.expiryDate
        ? Math.floor(
            (Date.parse(c.expiryDate) - Date.parse(now.toISOString().slice(0, 10))) / 86_400_000
          )
        : 0;

      for (const userId of recipients) {
        await createNotification({
          userId,
          // Contracts are org-only data and the link lands on an org-gated
          // page, so the notification has to say which organization it is for.
          organizationId: c.organizationId,
          type: "system",
          title: `Contract renewal due: ${c.title}`,
          message:
            daysLeft < 0
              ? `Expired on ${c.expiryDate} — action needed.`
              : `Expires ${c.expiryDate} (in ${daysLeft} day${daysLeft === 1 ? "" : "s"}).`,
          link: "/reports",
        });
      }
      run.notified++;
    }

    // A dry run does not claim anything, so the same page would repeat forever.
    if (dryRun || due.length < BATCH_SIZE) break;
    if (page > 50) break; // Backstop against an unexpected non-converging loop.
  }

  return run;
}

/** Scheduled invocation — this is the only entry point that mutates. */
export async function POST(req: NextRequest) {
  if (!(await verifyCronRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await processRenewals(false));
}

/**
 * Manual inspection only. GET used to perform the same mutations as POST, which
 * made the job runnable by anything that prefetches or replays a URL.
 */
export async function GET(req: NextRequest) {
  if (!(await verifyCronRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await processRenewals(true));
}
