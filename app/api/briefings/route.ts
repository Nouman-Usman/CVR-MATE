import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { companyBriefing } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

// GET /api/briefings?vat=12345678 — fetch saved briefings for a company
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

    const briefings = await db.query.companyBriefing.findMany({
      where: and(
        eq(companyBriefing.userId, session.user.id),
        eq(companyBriefing.companyVat, vat)
      ),
      orderBy: [desc(companyBriefing.createdAt)],
    });

    console.log(`[briefings GET] vat=${vat} userId=${session.user.id} found=${briefings.length}`);

    return NextResponse.json({ briefings });
  } catch (error) {
    console.error("Briefing fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch briefings" }, { status: 500 });
  }
}
