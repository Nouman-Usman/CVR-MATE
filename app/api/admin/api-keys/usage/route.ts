import { db } from "@/db";
import { apiKey, activity } from "@/db/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { getAuthContext, handleAuthError } from "@/lib/auth-context";

// GET /api/admin/api-keys/usage — usage stats for all org API keys
export async function GET() {
  try {
    const { orgId } = await getAuthContext({ resource: "api_keys", action: "read" });

    // Get all keys with basic info
    const keys = await db.query.apiKey.findMany({
      where: eq(apiKey.organizationId, orgId),
      orderBy: [desc(apiKey.createdAt)],
      columns: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        isActive: true,
        rateLimit: true,
        createdAt: true,
      },
    });

    // Get activity counts for the last 30 days per key (entity_type = 'api_key')
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const activityCounts = await db
      .select({
        entityId: activity.entityId,
        count: sql<number>`count(*)::int`,
      })
      .from(activity)
      .where(
        and(
          eq(activity.organizationId, orgId),
          eq(activity.entityType, "api_key"),
          gte(activity.createdAt, thirtyDaysAgo)
        )
      )
      .groupBy(activity.entityId);

    const countMap = new Map(
      activityCounts.map((a) => [a.entityId, a.count])
    );

    // Get recent activity (last 50 events across all keys)
    const recentActivity = await db
      .select({
        id: activity.id,
        entityId: activity.entityId,
        action: activity.action,
        ipAddress: activity.ipAddress,
        metadata: activity.metadata,
        createdAt: activity.createdAt,
      })
      .from(activity)
      .where(
        and(
          eq(activity.organizationId, orgId),
          eq(activity.entityType, "api_key")
        )
      )
      .orderBy(desc(activity.createdAt))
      .limit(50);

    // Build per-key usage summary
    const usage = keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      isActive: key.isActive,
      rateLimit: key.rateLimit,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      requestsLast30d: countMap.get(key.id) ?? 0,
    }));

    return Response.json({ usage, recentActivity });
  } catch (error) {
    return handleAuthError(error);
  }
}
