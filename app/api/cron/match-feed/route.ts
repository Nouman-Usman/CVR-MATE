import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { changeFeedCursor, userBrand, matchProfile } from "@/db/schema";
import { db } from "@/db";
import { verifyQStashRequest } from "@/lib/qstash";
import { checkEntitlement } from "@/lib/stripe/entitlements";
import { createNotification } from "@/lib/notifications";
import {
  generateMatchFeed,
  persistMatchFeed,
  toFeedDate,
} from "@/lib/match-feed/generate";

// Cron endpoint: generates the daily match feed for every paid user whose
// preferred notification hour matches the current hour (Europe/Copenhagen).
// Secured via QStash signature (production) or CRON_SECRET Bearer token (local).
// Scheduled via Upstash QStash (POST) — GET kept for manual testing.
//
// NOTE: the hourly QStash schedule that INVOKES this route must be registered
// out-of-band — there is no schedules.create in this codebase.

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH_SIZE = 5;
const MAX_USERS_PER_RUN = 200;
const STALE_LOCK_MS = 30 * 60 * 1000;

// verbatim from app/api/cron/triggers/route.ts
async function verifyAuth(req: NextRequest): Promise<boolean> {
  // Try QStash signature first (production)
  if (await verifyQStashRequest(req)) return true;
  // Fall back to Bearer token (manual/local testing)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`;
}

// Processing lock mirrored from app/api/cron/person-changes/route.ts, adapted
// to a dedicated "match-feed" cursor row. We don't track a real change id for
// this feed, so lastChangeId stays "0" for the row's lifetime.
async function acquireLock(): Promise<{
  acquired: boolean;
  cursorId: string | null;
}> {
  const now = new Date();

  const cursor = await db.query.changeFeedCursor.findFirst({
    where: eq(changeFeedCursor.feedType, "match-feed"),
  });

  if (!cursor) {
    const [created] = await db
      .insert(changeFeedCursor)
      .values({
        feedType: "match-feed",
        lastChangeId: "0",
        isProcessing: true,
        processingStartedAt: now,
      })
      .returning();
    return { acquired: true, cursorId: created.id };
  }

  if (cursor.isProcessing) {
    const startedAt = cursor.processingStartedAt;
    if (startedAt && now.getTime() - startedAt.getTime() < STALE_LOCK_MS) {
      return { acquired: false, cursorId: null };
    }
  }

  await db
    .update(changeFeedCursor)
    .set({ isProcessing: true, processingStartedAt: now })
    .where(eq(changeFeedCursor.id, cursor.id));

  return { acquired: true, cursorId: cursor.id };
}

async function releaseLock(cursorId: string) {
  await db
    .update(changeFeedCursor)
    .set({
      isProcessing: false,
      processingStartedAt: null,
      processedAt: new Date(),
    })
    .where(eq(changeFeedCursor.id, cursorId));
}

async function processMatchFeed() {
  const { acquired, cursorId } = await acquireLock();

  if (!acquired || !cursorId) {
    return NextResponse.json({ skipped: "locked" });
  }

  try {
    // Current hour in Europe/Copenhagen (0–23).
    const currentHour =
      Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Europe/Copenhagen",
          hour: "2-digit",
          hour12: false,
        }).format(new Date())
      ) % 24;

    const counts = {
      processed: 0,
      generated: 0,
      notified: 0,
      skippedGated: 0,
      skippedAlreadyToday: 0,
      errors: 0,
    };

    // Upsert-safe touch of matchProfile.lastGeneratedAt. The row usually exists
    // (generate's getMatchFilters upserts it), but guard like the engine does.
    const touchMatchProfile = async (userId: string) => {
      const existing = await db.query.matchProfile.findFirst({
        where: eq(matchProfile.userId, userId),
      });
      if (existing) {
        await db
          .update(matchProfile)
          .set({ lastGeneratedAt: new Date() })
          .where(eq(matchProfile.userId, userId));
      } else {
        await db
          .insert(matchProfile)
          .values({ userId, lastGeneratedAt: new Date() })
          .onConflictDoNothing();
      }
    };

    const processUser = async (userId: string) => {
      // a. Plan gate — only professional/enterprise get the match feed.
      const gate = await checkEntitlement(userId, "matchFeed");
      if (!gate.allowed) {
        counts.skippedGated++;
        return;
      }

      // b. Idempotency — never generate (and never re-hit the LLM) twice in one
      //    UTC day for the same user.
      const profile = await db.query.matchProfile.findFirst({
        where: eq(matchProfile.userId, userId),
      });
      if (
        profile?.lastGeneratedAt &&
        toFeedDate(new Date(profile.lastGeneratedAt)) === toFeedDate(new Date())
      ) {
        counts.skippedAlreadyToday++;
        return;
      }

      // c–d. Generate the personal feed (organizationId null is valid).
      const feedDate = toFeedDate(new Date());
      const result = await generateMatchFeed({
        userId,
        organizationId: null,
        locale: "en",
      });

      // e. Barren user — still mark generated so we don't retry all day.
      if (result.matches.length === 0) {
        await touchMatchProfile(userId);
        counts.processed++;
        return;
      }

      // f. Persist.
      const inserted = await persistMatchFeed({
        userId,
        organizationId: null,
        matches: result.matches,
        feedDate,
      });

      // g. Mark generated.
      await touchMatchProfile(userId);

      // h. Notify only when we actually inserted new matches.
      if (inserted > 0) {
        await createNotification({
          userId,
          type: "matches",
          title: `${inserted} new leads matched for you`,
          message: "Your daily matches are ready.",
          link: "/matches",
        });
        counts.notified++;
        counts.generated++;
      }

      // i.
      counts.processed++;
    };

    // Users due right now.
    const dueUsers = await db
      .select({ userId: userBrand.userId })
      .from(userBrand)
      .where(eq(userBrand.emailNotificationHour, currentHour))
      .limit(MAX_USERS_PER_RUN);

    // Bounded batches — a single user's failure must not abort the batch.
    for (let i = 0; i < dueUsers.length; i += BATCH_SIZE) {
      const batch = dueUsers.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((u) => processUser(u.userId))
      );
      for (const r of results) {
        if (r.status === "rejected") {
          counts.errors++;
          console.error("[match-feed] user failed:", r.reason);
        }
      }
    }

    return NextResponse.json({ ok: true, currentHour, counts });
  } finally {
    // The lock is ALWAYS released, even on error.
    await releaseLock(cursorId);
  }
}

// POST: Called by QStash in production
export async function POST(req: NextRequest) {
  if (!(await verifyAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return processMatchFeed();
}

// GET: For manual testing / backward compatibility
export async function GET(req: NextRequest) {
  if (!(await verifyAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return processMatchFeed();
}
