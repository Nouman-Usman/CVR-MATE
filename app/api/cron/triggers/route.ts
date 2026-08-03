import { NextRequest, NextResponse } from "next/server";
import { eq, and, lte, or, isNull, gte } from "drizzle-orm";
import { leadTrigger, triggerResult } from "@/db/schema";
import { db } from "@/db";
import { searchCompaniesElasticsearch, type ParsedCompany } from "@/lib/cvr-api-elasticsearch";
import { buildEsFilters } from "@/lib/triggers/build-es-filters";
import { createNotification } from "@/lib/notifications";
import { computeNextRun } from "@/lib/cron";
import { verifyQStashRequest } from "@/lib/qstash";
import { dispatchNotificationEmail } from "@/lib/email/dispatch";

// Cron endpoint: processes all active triggers that are due.
// Secured via QStash signature (production) or CRON_SECRET Bearer token (local/manual).
// Scheduled via Upstash QStash (POST) — GET kept for manual testing.

async function verifyAuth(req: NextRequest): Promise<boolean> {
  // Try QStash signature first (production)
  if (await verifyQStashRequest(req)) return true;
  // Fall back to Bearer token (manual/local testing)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`;
}

/**
 * Rolling recency window (in days) for a trigger, from its cadence. Bounds each
 * run to recently-founded companies so results don't accumulate since creation.
 * daily → last 1 day, weekly → last 7 days, custom → last 1 day (default).
 */
function windowDaysFor(frequency: string): number {
  if (frequency === "weekly") return 7;
  return 1; // daily / custom / default
}

async function processTriggers() {
  try {
    const now = new Date();

    // Find all active triggers that are due (nextRunAt <= now or nextRunAt is null)
    const dueTriggers = await db.query.leadTrigger.findMany({
      where: and(
        eq(leadTrigger.isActive, true),
        or(
          lte(leadTrigger.nextRunAt, now),
          isNull(leadTrigger.nextRunAt)
        )
      ),
    });

    const results: { triggerId: string; matchCount: number; error?: string }[] = [];

    for (const trigger of dueTriggers) {
      try {
        // Rolling recency window — overrides any stored founded_after so results
        // are bounded to recently-founded companies (daily → 1d, weekly → 7d)
        // instead of accumulating since the trigger was created.
        const windowDays = windowDaysFor(trigger.frequency);
        const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
        const filters = {
          ...((trigger.filters ?? {}) as Record<string, unknown>),
          founded_after: windowStart.toISOString().slice(0, 10), // YYYY-MM-DD
        };
        const esFilters = buildEsFilters(filters);

        // Paginate ES to collect up to 500 matches (5 pages × 100)
        const ES_PAGE_SIZE = 100;
        const MAX_PAGES = 5;
        const all: ParsedCompany[] = [];
        for (let p = 1; p <= MAX_PAGES; p++) {
          const result = await searchCompaniesElasticsearch(esFilters, p, ES_PAGE_SIZE);
          all.push(...result.companies);
          if (!result.hasMore) break;
        }

        // Sort newest-founded first, deduplicate by VAT, exclude dissolved
        all.sort((a, b) => (b.founded ?? "").localeCompare(a.founded ?? ""));
        const seen = new Set<number>();
        const unique = all.filter((c) => {
          if (seen.has(c.vat)) return false;
          if (c.isDissolved) return false;
          seen.add(c.vat);
          return true;
        });

        // Exclude companies this trigger already reported within the window, so
        // the date-granular overlap between consecutive runs doesn't re-notify
        // the same leads. Prior runs' companies live on triggerResult.companies.
        const priorResults = await db.query.triggerResult.findMany({
          where: and(
            eq(triggerResult.triggerId, trigger.id),
            gte(triggerResult.createdAt, windowStart)
          ),
          columns: { companies: true },
        });
        const alreadyReported = new Set<number>();
        for (const pr of priorResults) {
          for (const c of ((pr.companies as { vat?: number }[]) ?? [])) {
            if (typeof c?.vat === "number") alreadyReported.add(c.vat);
          }
        }
        const fresh = unique.filter((c) => !alreadyReported.has(c.vat));

        // Store summary (only the fresh, newly-surfaced companies)
        const companySummaries = fresh.slice(0, 100).map((c) => ({
          vat: c.vat,
          name: c.name,
          city: c.city,
          industry: c.industry,
          founded: c.founded,
        }));

        // Idempotency guard: QStash may retry if this request times out.
        // If a result was already recorded for this trigger in the last 5 minutes,
        // skip the insert so a retry doesn't produce duplicate rows.
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const recentResult = await db.query.triggerResult.findFirst({
          where: and(
            eq(triggerResult.triggerId, trigger.id),
            gte(triggerResult.createdAt, fiveMinutesAgo)
          ),
        });

        if (recentResult) {
          results.push({ triggerId: trigger.id, matchCount: recentResult.matchCount });
          continue;
        }

        await db.insert(triggerResult).values({
          triggerId: trigger.id,
          userId: trigger.userId,
          companies: companySummaries,
          matchCount: fresh.length,
        });

        // Compute next run
        const nextRun = computeNextRun(
          trigger.frequency,
          trigger.scheduledHour,
          trigger.scheduledMinute,
          trigger.scheduledDayOfWeek,
          trigger.timezone
        );

        // Update trigger
        await db
          .update(leadTrigger)
          .set({ lastRunAt: now, nextRunAt: nextRun })
          .where(eq(leadTrigger.id, trigger.id));

        // Dispatch notifications according to the trigger's notificationChannels setting.
        // Each channel is opt-in: ["in_app"] | ["email"] | ["in_app", "email"]
        if (fresh.length > 0) {
          const channels = (trigger.notificationChannels ?? ["in_app"]) as string[];

          if (channels.includes("in_app")) {
            await createNotification({
              userId: trigger.userId,
              type: "trigger",
              title: `${trigger.name}: ${fresh.length} matches`,
              message:
                fresh
                  .slice(0, 3)
                  .map((c) => c.name)
                  .filter(Boolean)
                  .join(", ") +
                (fresh.length > 3 ? ` +${fresh.length - 3} more` : ""),
              link: `/triggers`,
            });
          }

          if (channels.includes("email")) {
            // Queue async — don't block the cron response if email fails
            dispatchNotificationEmail({
              templateId: "daily_lead_update",
              userId: trigger.userId,
              data: {
                triggerName: trigger.name,
                triggerId: trigger.id,
                matchCount: fresh.length,
                companies: companySummaries.map((c) => ({
                  vat: String(c.vat),
                  name: c.name,
                  city: c.city,
                  industry: c.industry,
                })),
              },
            }).catch((err) =>
              console.error(`[email] Failed to queue for trigger ${trigger.id}:`, err)
            );
          }
        }

        results.push({ triggerId: trigger.id, matchCount: fresh.length });
      } catch (err) {
        console.error(`Cron: trigger ${trigger.id} failed:`, err);
        results.push({
          triggerId: trigger.id,
          matchCount: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      processed: dueTriggers.length,
      results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Cron trigger execution failed:", error);
    return NextResponse.json(
      { error: "Cron execution failed" },
      { status: 500 }
    );
  }
}

// POST: Called by QStash in production
export async function POST(req: NextRequest) {
  if (!(await verifyAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return processTriggers();
}

// GET: For manual testing / backward compatibility
export async function GET(req: NextRequest) {
  if (!(await verifyAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return processTriggers();
}
