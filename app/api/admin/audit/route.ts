import { NextRequest } from "next/server";
import { db } from "@/db";
import { activity, user } from "@/db/schema";
import { eq, and, desc, gte, lte, like, sql } from "drizzle-orm";
import { getAuthContext, handleAuthError } from "@/lib/auth-context";

// GET /api/admin/audit — query audit log with filters + pagination
export async function GET(request: NextRequest) {
  try {
    const { orgId } = await getAuthContext({ resource: "audit_log", action: "read" });

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
    const entityType = url.searchParams.get("entityType");
    const actionFilter = url.searchParams.get("action");
    const severity = url.searchParams.get("severity");
    const search = url.searchParams.get("search");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const conditions = [eq(activity.organizationId, orgId)];

    if (entityType) conditions.push(eq(activity.entityType, entityType));
    if (actionFilter) conditions.push(eq(activity.action, actionFilter));
    if (severity) conditions.push(eq(activity.severity, severity));
    if (from) conditions.push(gte(activity.createdAt, new Date(from)));
    if (to) conditions.push(lte(activity.createdAt, new Date(to)));

    const where = and(...conditions);

    // Get total count
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(activity)
      .where(where);

    // Get paginated results
    const offset = (page - 1) * limit;

    const logs = await db
      .select({
        id: activity.id,
        userId: activity.userId,
        entityType: activity.entityType,
        entityId: activity.entityId,
        action: activity.action,
        resource: activity.resource,
        severity: activity.severity,
        ipAddress: activity.ipAddress,
        userAgent: activity.userAgent,
        metadata: activity.metadata,
        createdAt: activity.createdAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(activity)
      .innerJoin(user, eq(activity.userId, user.id))
      .where(where)
      .orderBy(desc(activity.createdAt))
      .limit(limit)
      .offset(offset);

    return Response.json({
      logs,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
