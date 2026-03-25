import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { outreachMessage } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

// GET /api/outreach?vat=12345678 — fetch saved outreach messages for a company
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vat = req.nextUrl.searchParams.get("vat");
    if (!vat) {
      return NextResponse.json({ error: "vat is required" }, { status: 400 });
    }

    const messages = await db.query.outreachMessage.findMany({
      where: and(
        eq(outreachMessage.userId, session.user.id),
        eq(outreachMessage.companyVat, vat)
      ),
      orderBy: [desc(outreachMessage.createdAt)],
    });

    console.log(`[outreach GET] vat=${vat} userId=${session.user.id} found=${messages.length}`);

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Outreach fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

// POST /api/outreach — save a generated outreach message
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { companyVat, companyName, type, tone, subject, message, followUp } = body;

    if (!companyVat || !companyName || !type || !tone || !message || !followUp) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [saved] = await db
      .insert(outreachMessage)
      .values({
        userId: session.user.id,
        companyVat,
        companyName,
        type,
        tone,
        subject: subject || null,
        message,
        followUp,
      })
      .returning();

    return NextResponse.json({ message: saved });
  } catch (error) {
    console.error("Outreach save error:", error);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }
}
