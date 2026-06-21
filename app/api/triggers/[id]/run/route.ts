import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { leadTrigger, triggerResult } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { searchCompaniesElasticsearch, type ParsedCompany } from "@/lib/cvr-api-elasticsearch";
import { buildEsFilters } from "@/lib/triggers/build-es-filters";
import { createNotification } from "@/lib/notifications";
import { computeNextRun } from "@/lib/cron";
import { dispatchNotificationEmail } from "@/lib/email/dispatch";
import { getOrgMembership } from "@/lib/team/permissions";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch the trigger — allow personal triggers (owner) or team triggers (org member)
    const trigger = await db.query.leadTrigger.findFirst({
      where: eq(leadTrigger.id, id),
    });

    if (!trigger) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Access check: personal trigger requires ownership; team trigger requires membership
    if (trigger.organizationId) {
      const membership = await getOrgMembership(session.user.id, trigger.organizationId);
      if (!membership) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else if (trigger.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const filters = (trigger.filters ?? {}) as Record<string, unknown>;
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

    // Store a summary of results (not the full raw data to keep DB lightweight)
    const companySummaries = unique.slice(0, 100).map((c) => ({
      vat: c.vat,
      name: c.name,
      city: c.city,
      industry: c.industry,
      founded: c.founded,
    }));

    // Save trigger result
    const [result] = await db
      .insert(triggerResult)
      .values({
        triggerId: trigger.id,
        userId: session.user.id,
        companies: companySummaries,
        matchCount: unique.length,
      })
      .returning();

    // Compute next scheduled run
    const nextRun = computeNextRun(
      trigger.frequency,
      trigger.scheduledHour,
      trigger.scheduledMinute,
      trigger.scheduledDayOfWeek,
      trigger.timezone
    );

    // Update trigger lastRunAt + nextRunAt
    await db
      .update(leadTrigger)
      .set({ lastRunAt: new Date(), nextRunAt: nextRun })
      .where(eq(leadTrigger.id, id));

    // Dispatch notifications according to the trigger's notificationChannels setting
    if (unique.length > 0) {
      const channels = (trigger.notificationChannels ?? ["in_app"]) as string[];

      if (channels.includes("in_app")) {
        await createNotification({
          userId: session.user.id,
          type: "trigger",
          title: `${trigger.name}: ${unique.length} matches`,
          message:
            unique
              .slice(0, 3)
              .map((c) => c.name)
              .filter(Boolean)
              .join(", ") +
            (unique.length > 3 ? ` +${unique.length - 3} more` : ""),
          link: `/triggers`,
        });
      }

      if (channels.includes("email")) {
        dispatchNotificationEmail({
          templateId: "daily_lead_update",
          userId: session.user.id,
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

    return NextResponse.json({
      result: {
        ...result,
        matchCount: unique.length,
      },
    });
  } catch (error) {
    console.error("Failed to run trigger:", error);
    const message =
      error instanceof Error ? error.message : "Failed to run trigger";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
