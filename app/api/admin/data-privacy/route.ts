import { NextRequest } from "next/server";
import { db } from "@/db";
import { dataRetentionPolicy, dataExportRequest, user } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthContext, handleAuthError } from "@/lib/auth-context";
import { logSettingsChanged } from "@/lib/audit";

// GET /api/admin/data-privacy — get retention policy + export requests
export async function GET() {
  try {
    const { orgId } = await getAuthContext({ resource: "settings", action: "read" });

    const [policy, exports] = await Promise.all([
      db.query.dataRetentionPolicy.findFirst({
        where: eq(dataRetentionPolicy.organizationId, orgId),
      }),
      db
        .select({
          id: dataExportRequest.id,
          type: dataExportRequest.type,
          status: dataExportRequest.status,
          downloadUrl: dataExportRequest.downloadUrl,
          expiresAt: dataExportRequest.expiresAt,
          createdAt: dataExportRequest.createdAt,
          completedAt: dataExportRequest.completedAt,
          requestedByName: user.name,
          requestedByEmail: user.email,
        })
        .from(dataExportRequest)
        .innerJoin(user, eq(dataExportRequest.requestedByUserId, user.id))
        .where(eq(dataExportRequest.organizationId, orgId))
        .orderBy(desc(dataExportRequest.createdAt))
        .limit(20),
    ]);

    return Response.json({
      retention: policy ?? {
        activityRetentionDays: 365,
        auditLogRetentionDays: 730,
        deletedDataRetentionDays: 30,
        exportRetentionDays: 90,
      },
      exports,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST /api/admin/data-privacy — update retention or request export
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await getAuthContext({ resource: "settings", action: "update" });

    const body = await request.json();
    const { action } = body as { action: string };

    switch (action) {
      case "update_retention": {
        const { activityRetentionDays, auditLogRetentionDays, deletedDataRetentionDays, exportRetentionDays } = body;

        const existing = await db.query.dataRetentionPolicy.findFirst({
          where: eq(dataRetentionPolicy.organizationId, orgId),
        });

        const values = {
          activityRetentionDays: activityRetentionDays ?? 365,
          auditLogRetentionDays: auditLogRetentionDays ?? 730,
          deletedDataRetentionDays: deletedDataRetentionDays ?? 30,
          exportRetentionDays: exportRetentionDays ?? 90,
        };

        if (existing) {
          await db.update(dataRetentionPolicy).set(values).where(eq(dataRetentionPolicy.organizationId, orgId));
        } else {
          await db.insert(dataRetentionPolicy).values({ organizationId: orgId, ...values });
        }

        await logSettingsChanged(userId, orgId, ["dataRetention"]);
        return Response.json({ success: true });
      }

      case "request_export": {
        const { type } = body as { type: string };

        if (!["gdpr_export", "bulk_export"].includes(type)) {
          return Response.json({ error: "Invalid export type" }, { status: 400 });
        }

        const [req] = await db
          .insert(dataExportRequest)
          .values({
            organizationId: orgId,
            requestedByUserId: userId,
            type,
            status: "pending",
          })
          .returning();

        return Response.json({ export: req }, { status: 201 });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    return handleAuthError(error);
  }
}
