import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { crmSyncLog } from "@/db/schema";

// GET /api/integrations/sync/history — paginated sync log
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20"), 50);
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");

    const logs = await db.query.crmSyncLog.findMany({
      where: eq(crmSyncLog.userId, session.user.id),
      orderBy: [desc(crmSyncLog.createdAt)],
      limit,
      offset,
      with: {
        connection: {
          columns: { provider: true },
        },
      },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Sync history error:", error);
    return NextResponse.json({ error: "Failed to fetch sync history" }, { status: 500 });
  }
}
