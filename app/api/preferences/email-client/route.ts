import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { userBrand } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";

const VALID_CLIENTS = ["default", "gmail", "outlook"] as const;
type EmailClient = (typeof VALID_CLIENTS)[number];

function cacheKey(userId: string) {
  return `pref:email-client:${userId}`;
}

// GET /api/preferences/email-client
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Try Redis cache first
    const cached = await cacheGet<string>(cacheKey(session.user.id));
    if (cached) {
      return NextResponse.json({ emailClient: cached });
    }

    // Fall back to DB
    const brand = await db.query.userBrand.findFirst({
      where: eq(userBrand.userId, session.user.id),
      columns: { preferredEmailClient: true },
    });

    const value = brand?.preferredEmailClient ?? "default";

    // Warm cache (24h TTL)
    await cacheSet(cacheKey(session.user.id), value, 86400);

    return NextResponse.json({ emailClient: value });
  } catch (error) {
    console.error("Failed to fetch email client preference:", error);
    return NextResponse.json(
      { error: "Failed to fetch preference" },
      { status: 500 }
    );
  }
}

// PATCH /api/preferences/email-client
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { emailClient } = body;

    if (!emailClient || !VALID_CLIENTS.includes(emailClient)) {
      return NextResponse.json(
        { error: `Invalid email client. Must be one of: ${VALID_CLIENTS.join(", ")}` },
        { status: 400 }
      );
    }

    // Upsert into userBrand
    const existing = await db.query.userBrand.findFirst({
      where: eq(userBrand.userId, session.user.id),
      columns: { id: true },
    });

    if (existing) {
      await db
        .update(userBrand)
        .set({ preferredEmailClient: emailClient as EmailClient })
        .where(eq(userBrand.id, existing.id));
    } else {
      // Create a minimal brand record if none exists
      await db.insert(userBrand).values({
        userId: session.user.id,
        companyName: "",
        products: "",
        preferredEmailClient: emailClient as EmailClient,
      });
    }

    // Update Redis cache
    await cacheSet(cacheKey(session.user.id), emailClient, 86400);

    return NextResponse.json({ emailClient });
  } catch (error) {
    console.error("Failed to update email client preference:", error);
    return NextResponse.json(
      { error: "Failed to update preference" },
      { status: 500 }
    );
  }
}
