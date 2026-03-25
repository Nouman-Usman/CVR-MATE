import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { crmConnection } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// GET /api/integrations — list user's CRM connections
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connections = await db.query.crmConnection.findMany({
      where: eq(crmConnection.userId, session.user.id),
      columns: {
        id: true,
        provider: true,
        isActive: true,
        connectedAt: true,
        lastRefreshedAt: true,
        scopes: true,
      },
    });

    return NextResponse.json({ connections });
  } catch (error) {
    console.error("Failed to fetch integrations:", error);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }
}
