import { NextRequest, NextResponse } from "next/server";
import { eq, desc, count } from "drizzle-orm";
import { leadTrigger } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { computeNextRun, buildCronExpression } from "@/lib/cron";
import { checkUsageEntitlement } from "@/lib/stripe/entitlements";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const triggers = await db.query.leadTrigger.findMany({
      where: eq(leadTrigger.userId, session.user.id),
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

    const orgId = session.session.activeOrganizationId ?? "";

    // Check trigger limit
    const [{ value: triggerCount }] = await db
      .select({ value: count() })
      .from(leadTrigger)
      .where(eq(leadTrigger.userId, session.user.id));

    const { allowed, limit } = await checkUsageEntitlement(
      orgId,
      "triggers",
      triggerCount
    );
    if (!allowed) {
      return NextResponse.json(
        { error: `Trigger limit reached (${limit}). Upgrade your plan for more.`, upgrade: true },
        { status: 403 }
      );
    }

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
    } = body;

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
