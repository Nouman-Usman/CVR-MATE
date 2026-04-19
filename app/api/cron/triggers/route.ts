import { NextRequest, NextResponse } from "next/server";
import { eq, and, lte, or, isNull } from "drizzle-orm";
import { leadTrigger, triggerResult } from "@/db/schema";
import { db } from "@/db";
import { searchCompanies, type SearchCompanyParams } from "@/lib/cvr-api";
import { createNotification } from "@/lib/notifications";
import { computeNextRun } from "@/lib/cron";
import { verifyQStashRequest } from "@/lib/qstash";
import { dispatchNotificationEmail } from "@/lib/email/dispatch";

// Cron endpoint: processes all active triggers that are due.
// Secured via QStash signature (production) or CRON_SECRET Bearer token (local/manual).
// Scheduled via Upstash QStash (POST) — GET kept for manual testing.

function buildSearchParams(filters: Record<string, unknown>): SearchCompanyParams {
  const params: SearchCompanyParams = {
    companystatus_code: "20",
  };
  if (filters.industry_code)
    params.industry_primary_code = String(filters.industry_code);
  if (filters.city) params.address_city = String(filters.city);
  if (filters.region) params.address_municipality = String(filters.region);
  if (filters.company_type)
    params.companyform_description = String(filters.company_type);
  if (filters.min_employees)
    params.employment_interval_low = String(filters.min_employees);
  if (filters.founded_after)
    params.life_start = String(filters.founded_after);
  return params;
}

async function verifyAuth(req: NextRequest): Promise<boolean> {
  // Try QStash signature first (production)
  if (await verifyQStashRequest(req)) return true;
  // Fall back to Bearer token (manual/local testing)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`;
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
        const filters = (trigger.filters ?? {}) as Record<string, unknown>;
        const searchParams = buildSearchParams(filters);

        // Execute CVR search
        const companies = await searchCompanies(searchParams);
        const rawResults = Array.isArray(companies) ? companies : [];

        // Sort newest first and deduplicate
        rawResults.sort((a, b) => {
          const da = a.life?.start || "";
          const db2 = b.life?.start || "";
          return db2.localeCompare(da);
        });
        const seen = new Set<number>();
        const unique = rawResults.filter((c) => {
          if (seen.has(c.vat)) return false;
          seen.add(c.vat);
          return true;
        });

        // Store summary
        const companySummaries = unique.slice(0, 100).map((c) => ({
          vat: c.vat,
          name: c.life?.name ?? "",
          city: c.address?.cityname ?? "",
          industry: c.industry?.primary?.text ?? "",
          founded: c.life?.start ?? "",
        }));

        await db.insert(triggerResult).values({
          triggerId: trigger.id,
          userId: trigger.userId,
          companies: companySummaries,
          matchCount: unique.length,
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
        if (unique.length > 0) {
          const channels = (trigger.notificationChannels ?? ["in_app"]) as string[];

          if (channels.includes("in_app")) {
            await createNotification({
              userId: trigger.userId,
              type: "trigger",
              title: `${trigger.name}: ${unique.length} matches`,
              message:
                unique
                  .slice(0, 3)
                  .map((c) => c.life?.name ?? "")
                  .filter(Boolean)
                  .join(", ") +
                (unique.length > 3 ? ` +${unique.length - 3} more` : ""),
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
                matchCount: unique.length,
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

        results.push({ triggerId: trigger.id, matchCount: unique.length });
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
