import { NextRequest, NextResponse } from "next/server";
import { eq, desc, count, or, and, isNull, sql } from "drizzle-orm";
import { leadTrigger } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { computeNextRun, buildCronExpression } from "@/lib/cron";
import { checkUsageEntitlement } from "@/lib/stripe/entitlements";
import { validateActiveOrg } from "@/lib/team/permissions";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate active org from session (DB-verified, never trusted blindly)
    const activeOrgId = await validateActiveOrg(
      session.user.id,
      session.session?.activeOrganizationId
    );

    // Personal triggers (userId = me, no org) + team triggers (org = activeOrg)
    const triggers = await db.query.leadTrigger.findMany({
      where: or(
        and(eq(leadTrigger.userId, session.user.id), isNull(leadTrigger.organizationId)),
        activeOrgId ? eq(leadTrigger.organizationId, activeOrgId) : sql`false`
      ),
      with: {
        results: {
          orderBy: (r, { desc }) => [desc(r.createdAt)],
          limit: 1,
        },
      },
      orderBy: [desc(leadTrigger.createdAt)],
    });

    return NextResponse.json({ triggers });
  } catch (error) {
    console.error("Failed to fetch triggers:", error);
    return NextResponse.json(
      { error: "Failed to fetch triggers" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check active trigger limit (only personal triggers count against user quota)
    const [{ value: triggerCount }] = await db
      .select({ value: count() })
      .from(leadTrigger)
      .where(
        and(
          eq(leadTrigger.userId, session.user.id),
          isNull(leadTrigger.organizationId),
          eq(leadTrigger.isActive, true)
        )
      );

    const { allowed, limit } = await checkUsageEntitlement(
      session.user.id,
      "triggers",
      triggerCount
    );

    const body = await req.json();
    const {
      name,
      filters,
      frequency,
      notificationChannels,
      scheduledHour,
      scheduledMinute,
      scheduledDayOfWeek,
      timezone,
      scope,
    } = body;

    // Determine org scope
    const activeOrgId = await validateActiveOrg(
      session.user.id,
      session.session?.activeOrganizationId
    );
    const organizationId = scope === "team" && activeOrgId ? activeOrgId : null;

    // Personal triggers check plan limits; team triggers don't count against personal quota
    if (!organizationId && !allowed) {
      return NextResponse.json(
        { error: `Active trigger limit reached (${limit}). Upgrade your plan for more.`, upgrade: true },
        { status: 403 }
      );
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const freq = frequency ?? "daily";
    const hour = scheduledHour ?? 8;
    const minute = scheduledMinute ?? 0;
    const dow = freq === "weekly" ? (scheduledDayOfWeek ?? 1) : null; // default Monday
    const tz = timezone ?? "Europe/Copenhagen";

    const cronExpr = buildCronExpression(freq, hour, minute, dow);
    const nextRunAt = computeNextRun(freq, hour, minute, dow, tz);

    const [newTrigger] = await db
      .insert(leadTrigger)
      .values({
        userId: session.user.id,
        organizationId,
        name: name.trim(),
        filters: filters ?? {},
        frequency: freq,
        notificationChannels: notificationChannels ?? ["in_app"],
        scheduledHour: hour,
        scheduledMinute: minute,
        scheduledDayOfWeek: dow,
        timezone: tz,
        cronExpression: cronExpr,
        nextRunAt,
      })
      .returning();

    return NextResponse.json({ trigger: newTrigger }, { status: 201 });
  } catch (error) {
    console.error("Failed to create trigger:", error);
    return NextResponse.json(
      { error: "Failed to create trigger" },
      { status: 500 }
    );
  }
}
