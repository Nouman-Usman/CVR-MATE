import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { crmConnection, crmSyncMapping } from "@/db/schema";

// GET /api/integrations/sync/status?companyId=... — get sync status for a company
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    // Get user's active connections
    const connections = await db.query.crmConnection.findMany({
      where: and(
        eq(crmConnection.userId, session.user.id),
        eq(crmConnection.isActive, true)
      ),
      columns: { id: true, provider: true },
    });

    if (connections.length === 0) {
      return NextResponse.json({ statuses: [] });
    }

    // Get sync mappings for this company across all connections
    const mappings = await db.query.crmSyncMapping.findMany({
      where: and(
        eq(crmSyncMapping.localEntityType, "company"),
        eq(crmSyncMapping.localEntityId, companyId)
      ),
    });

    const statuses = connections.map((conn) => {
      const mapping = mappings.find((m) => m.connectionId === conn.id);
      return {
        provider: conn.provider,
        connectionId: conn.id,
        synced: !!mapping,
        syncStatus: mapping?.syncStatus ?? null,
        lastSyncedAt: mapping?.lastSyncedAt ?? null,
        crmEntityId: mapping?.crmEntityId ?? null,
        syncError: mapping?.syncError ?? null,
      };
    });

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("Sync status error:", error);
    return NextResponse.json({ error: "Failed to fetch sync status" }, { status: 500 });
  }
}
