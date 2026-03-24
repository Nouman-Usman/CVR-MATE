import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { leadTrigger } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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

    const body = await req.json();
    const { name, filters, frequency, notificationChannels } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const [newTrigger] = await db
      .insert(leadTrigger)
      .values({
        userId: session.user.id,
        name: name.trim(),
        filters: filters ?? {},
        frequency: frequency ?? "daily",
        notificationChannels: notificationChannels ?? ["in_app"],
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
