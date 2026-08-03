import "server-only";

import { eq } from "drizzle-orm";
import { changeFeedCursor, userBrand, matchProfile } from "@/db/schema";
import { db } from "@/db";
import { checkEntitlement } from "@/lib/stripe/entitlements";
import { createNotification } from "@/lib/notifications";
import { dispatchNotificationEmail } from "@/lib/email/dispatch";
import { generateMatchFeed, persistMatchFeed, toFeedDate } from "@/lib/match-feed/generate";

// Shared runner for the daily match-feed generation. Invoked by BOTH the QStash
// cron route (app/api/cron/match-feed/route.ts) and the admin "Run now" action
// (app/api/admin/match-feed/route.ts), so the logic lives here rather than in a
// route handler. Returns a plain result object; callers wrap it as they need.
//
// Generates the daily match feed for every paid user, at most once per UTC day.
// The same-day idempotency guard (matchProfile.lastGeneratedAt) dedupes across
// the hourly cron runs — a user's feed generates on the FIRST run of the day and
// is skipped for the rest. There is no per-user notification-hour gate.

const BATCH_SIZE = 5;
const MAX_USERS_PER_RUN = 200;
const STALE_LOCK_MS = 30 * 60 * 1000;

export const MATCH_FEED_CURSOR = "match-feed";

export interface MatchFeedRunCounts {
  processed: number;
  generated: number;
  notified: number;
  emailed: number;
  skippedGated: number;
  skippedAlreadyToday: number;
  errors: number;
}

export type MatchFeedRunResult =
  | { skipped: "locked" }
  | { ok: true; currentHour: number; counts: MatchFeedRunCounts };

// Processing lock mirrored from app/api/cron/person-changes/route.ts, adapted to
// a dedicated "match-feed" cursor row. We don't track a real change id for this
// feed, so lastChangeId stays "0" for the row's lifetime.
async function acquireLock(): Promise<{ acquired: boolean; cursorId: string | null }> {
  const now = new Date();

  const cursor = await db.query.changeFeedCursor.findFirst({
    where: eq(changeFeedCursor.feedType, MATCH_FEED_CURSOR),
  });

  if (!cursor) {
    const [created] = await db
      .insert(changeFeedCursor)
      .values({
        feedType: MATCH_FEED_CURSOR,
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
    .set({ isProcessing: false, processingStartedAt: null, processedAt: new Date() })
    .where(eq(changeFeedCursor.id, cursorId));
}

export async function runMatchFeed(): Promise<MatchFeedRunResult> {
  const { acquired, cursorId } = await acquireLock();
  if (!acquired || !cursorId) return { skipped: "locked" };

  try {
    // Current hour in Europe/Copenhagen (0–23) — informational only now.
    const currentHour =
      Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Europe/Copenhagen",
          hour: "2-digit",
          hour12: false,
        }).format(new Date())
      ) % 24;

    const counts: MatchFeedRunCounts = {
      processed: 0,
      generated: 0,
      notified: 0,
      emailed: 0,
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
      const result = await generateMatchFeed({ userId, organizationId: null, locale: "en" });

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

      // h. Notify (in-app) + email only when we actually inserted new matches.
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

        // Daily "matches ready" email. dispatch handles preference opt-out
        // (emailNotificationsEnabled + dailyLeadEmails) and localhost/QStash
        // routing. A mail failure must NOT fail the user's generation.
        try {
          await dispatchNotificationEmail({
            templateId: "match_feed",
            userId,
            data: {
              matchCount: result.matches.length,
              companies: result.matches.map((m) => ({
                vat: m.cvr,
                name: m.companySnapshot.name,
                city: m.companySnapshot.city,
                industry: m.companySnapshot.industry,
              })),
            },
          });
          counts.emailed++;
        } catch (e) {
          console.error("[match-feed] email dispatch failed for", userId, e);
        }
      }

      // i.
      counts.processed++;
    };

    // Every user with a brand profile is eligible on every run — no hour shard.
    // The plan gate (step a) and same-day idempotency guard (step b) keep this
    // correct and cheap: each user generates once per UTC day and is skipped for
    // the remaining runs. See the >MAX_USERS_PER_RUN note if the base grows.
    const dueUsers = await db
      .select({ userId: userBrand.userId })
      .from(userBrand)
      .limit(MAX_USERS_PER_RUN);

    // Bounded batches — a single user's failure must not abort the batch.
    for (let i = 0; i < dueUsers.length; i += BATCH_SIZE) {
      const batch = dueUsers.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((u) => processUser(u.userId)));
      for (const r of results) {
        if (r.status === "rejected") {
          counts.errors++;
          console.error("[match-feed] user failed:", r.reason);
        }
      }
    }

    return { ok: true, currentHour, counts };
  } finally {
    // The lock is ALWAYS released, even on error.
    await releaseLock(cursorId);
  }
}
