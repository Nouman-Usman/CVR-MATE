import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { crmConnection } from "@/db/schema";
import { checkConnectionHealth } from "@/lib/crm/health";
import type { CrmProvider } from "@/lib/crm/types";

// POST /api/integrations/health — test a specific CRM connection
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { connectionId } = await req.json();
    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
    }

    // Verify ownership
    const conn = await db.query.crmConnection.findFirst({
      where: and(
        eq(crmConnection.id, connectionId),
        eq(crmConnection.userId, session.user.id)
      ),
    });
    if (!conn) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const result = await checkConnectionHealth(connectionId, conn.provider as CrmProvider);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json({ error: "Health check failed" }, { status: 500 });
  }
}
