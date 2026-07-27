import { NextResponse } from "next/server";
import { eq, and, gte, desc, count } from "drizzle-orm";
import { db } from "@/db";
import { crmConnection, crmSyncLog, crmSyncMapping, user } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/require-admin";

/**
 * GET /api/admin/integrations
 * CRM integration health: active connections by provider (+ token-expiry
 * warnings), 7-day sync success/error rate, recent errors, and mapping backlog.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // expiring within 3 days

    const [byProvider, connections, syncStatusCounts, recentErrors, mappingBacklog] = await Promise.all([
      db.select({ provider: crmConnection.provider, total: count() })
        .from(crmConnection).where(eq(crmConnection.isActive, true)).groupBy(crmConnection.provider),

      db.select({
        provider: crmConnection.provider, email: user.email, isActive: crmConnection.isActive,
        tokenExpiresAt: crmConnection.tokenExpiresAt, connectedAt: crmConnection.connectedAt,
        lastRefreshedAt: crmConnection.lastRefreshedAt,
      })
        .from(crmConnection).innerJoin(user, eq(crmConnection.userId, user.id))
        .orderBy(desc(crmConnection.connectedAt)).limit(50),

      db.select({ status: crmSyncLog.status, total: count() })
        .from(crmSyncLog).where(gte(crmSyncLog.createdAt, weekAgo)).groupBy(crmSyncLog.status),

      db.select({
        id: crmSyncLog.id, action: crmSyncLog.action, status: crmSyncLog.status,
        errorMessage: crmSyncLog.errorMessage, createdAt: crmSyncLog.createdAt,
      })
        .from(crmSyncLog).where(and(eq(crmSyncLog.status, "error"), gte(crmSyncLog.createdAt, weekAgo)))
        .orderBy(desc(crmSyncLog.createdAt)).limit(25),

      db.select({ syncStatus: crmSyncMapping.syncStatus, total: count() })
        .from(crmSyncMapping).groupBy(crmSyncMapping.syncStatus),
    ]);

    const syncTotals = syncStatusCounts.reduce((acc, s) => { acc[s.status] = Number(s.total); return acc; }, {} as Record<string, number>);
    const totalSyncs = Object.values(syncTotals).reduce((a, b) => a + b, 0);
    const errorRate = totalSyncs > 0 ? (syncTotals.error ?? 0) / totalSyncs : 0;

    const connectionsWithFlags = connections.map((c) => ({
      ...c,
      tokenExpiringSoon: !!c.tokenExpiresAt && new Date(c.tokenExpiresAt) < soon,
      tokenExpired: !!c.tokenExpiresAt && new Date(c.tokenExpiresAt) < now,
    }));

    return NextResponse.json({
      generatedAt: now.toISOString(),
      summary: {
        activeConnections: byProvider.reduce((a, p) => a + Number(p.total), 0),
        totalSyncs7d: totalSyncs, errorRate,
        expiringSoon: connectionsWithFlags.filter((c) => c.tokenExpiringSoon).length,
      },
      byProvider,
      syncStatus: syncStatusCounts,
      mappingBacklog,
      connections: connectionsWithFlags,
      recentErrors,
    });
  } catch (error) {
    console.error("Admin integrations failed:", error);
    return NextResponse.json({ error: "Failed to load integrations" }, { status: 500 });
  }
}
