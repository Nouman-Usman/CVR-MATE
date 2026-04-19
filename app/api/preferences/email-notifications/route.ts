import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { userBrand } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

interface EmailNotificationPrefs {
  emailNotificationsEnabled: boolean;
  dailyLeadEmails: boolean;
  weeklySummaryEmails: boolean;
  emailNotificationHour: number;
}

// GET /api/preferences/email-notifications
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const brand = await db.query.userBrand.findFirst({
      where: eq(userBrand.userId, session.user.id),
      columns: {
        emailNotificationsEnabled: true,
        dailyLeadEmails: true,
        weeklySummaryEmails: true,
        emailNotificationHour: true,
      },
    });

    const prefs: EmailNotificationPrefs = {
      emailNotificationsEnabled: brand?.emailNotificationsEnabled ?? true,
      dailyLeadEmails: brand?.dailyLeadEmails ?? true,
      weeklySummaryEmails: brand?.weeklySummaryEmails ?? true,
      emailNotificationHour: brand?.emailNotificationHour ?? 8,
    };

    return NextResponse.json(prefs);
  } catch (error) {
    console.error("[preferences/email-notifications] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

// PATCH /api/preferences/email-notifications
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Validate fields — only accept known keys
    const allowed = new Set([
      "emailNotificationsEnabled",
      "dailyLeadEmails",
      "weeklySummaryEmails",
      "emailNotificationHour",
    ]);

    const update: Partial<EmailNotificationPrefs> = {};

    for (const [key, value] of Object.entries(body)) {
      if (!allowed.has(key)) continue;

      if (key === "emailNotificationHour") {
        const hour = Number(value);
        if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
          return NextResponse.json(
            { error: "emailNotificationHour must be an integer 0–23" },
            { status: 400 }
          );
        }
        update.emailNotificationHour = hour;
      } else {
        if (typeof value !== "boolean") {
          return NextResponse.json(
            { error: `${key} must be a boolean` },
            { status: 400 }
          );
        }
        (update as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    const existing = await db.query.userBrand.findFirst({
      where: eq(userBrand.userId, session.user.id),
      columns: { id: true },
    });

    if (existing) {
      await db
        .update(userBrand)
        .set(update)
        .where(eq(userBrand.id, existing.id));
    } else {
      // Create a minimal brand record if none exists
      await db.insert(userBrand).values({
        userId: session.user.id,
        companyName: "",
        products: "",
        ...update,
      });
    }

    return NextResponse.json({ updated: true, ...update });
  } catch (error) {
    console.error("[preferences/email-notifications] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
