import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { leadTrigger, triggerResult } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { searchCompanies, type SearchCompanyParams } from "@/lib/cvr-api";
import { createNotification } from "@/lib/notifications";
import { computeNextRun } from "@/lib/cron";
import { dispatchNotificationEmail } from "@/lib/email/dispatch";
import { getOrgMembership } from "@/lib/team/permissions";

// Maps trigger filter keys to CVR API search params
function buildSearchParams(filters: Record<string, unknown>): SearchCompanyParams {
  const params: SearchCompanyParams = {
    companystatus_code: "20", // active companies only
  };

  if (filters.branch_code)
    params.industry_primary_code = String(filters.branch_code);
  else if (filters.industry_code)
    params.industry_primary_code = String(filters.industry_code);
  if (filters.city)
    params.address_city = String(filters.city);
  if (filters.region) {
    // Region is handled via zipcode list — simplified here to city mapping
    params.address_municipality = String(filters.region);
  }
  if (filters.company_type)
    params.companyform_description = String(filters.company_type);
  if (filters.min_employees)
    params.employment_interval_low = String(filters.min_employees);
  if (filters.founded_after)
    params.life_start = String(filters.founded_after);

  return params;
}

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
    const searchParams = buildSearchParams(filters);

    // Execute CVR search
    const companies = await searchCompanies(searchParams);
    const results = Array.isArray(companies) ? companies : [];

    // Sort newest first and deduplicate
    results.sort((a, b) => {
      const da = a.life?.start || "";
      const db2 = b.life?.start || "";
      return db2.localeCompare(da);
    });
    const seen = new Set<number>();
    const unique = results.filter((c) => {
      if (seen.has(c.vat)) return false;
      seen.add(c.vat);
      return true;
    });

    // Store a summary of results (not the full raw data to keep DB lightweight)
    const companySummaries = unique.slice(0, 100).map((c) => ({
      vat: c.vat,
      name: c.life?.name ?? "",
      city: c.address?.cityname ?? "",
      industry: c.industry?.primary?.text ?? "",
      founded: c.life?.start ?? "",
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
              .map((c) => c.life?.name ?? "")
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
