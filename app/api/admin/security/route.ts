import { NextRequest } from "next/server";
import { db } from "@/db";
import { ssoConfig, ipAllowlist, organization, session, user } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuthContext, handleAuthError } from "@/lib/auth-context";
import { logSettingsChanged } from "@/lib/audit";

// GET /api/admin/security — get SSO config, IP allowlist, active sessions
export async function GET() {
  try {
    const { orgId } = await getAuthContext({ resource: "settings", action: "read" });

    const [sso, ipRules, org] = await Promise.all([
      db.query.ssoConfig.findFirst({
        where: eq(ssoConfig.organizationId, orgId),
      }),
      db.query.ipAllowlist.findMany({
        where: eq(ipAllowlist.organizationId, orgId),
        orderBy: [desc(ipAllowlist.createdAt)],
      }),
      db.query.organization.findFirst({
        where: eq(organization.id, orgId),
        columns: { settings: true },
      }),
    ]);

    const settings = (org?.settings ?? {}) as Record<string, unknown>;

    return Response.json({
      sso: sso ?? null,
      ipAllowlist: ipRules,
      twoFactorRequired: settings.twoFactorRequired ?? false,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST /api/admin/security — update security settings
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await getAuthContext({ resource: "settings", action: "update" });

    const body = await request.json();
    const { action: secAction } = body as { action: string };

    switch (secAction) {
      case "update_sso": {
        const { provider, entityId, ssoUrl, certificate, metadataUrl, enforced, allowedDomains } = body;

        const existing = await db.query.ssoConfig.findFirst({
          where: eq(ssoConfig.organizationId, orgId),
        });

        if (existing) {
          await db
            .update(ssoConfig)
            .set({
              provider,
              entityId,
              ssoUrl,
              certificate,
              metadataUrl,
              enforced: enforced ?? false,
              allowedDomains: allowedDomains ?? [],
            })
            .where(eq(ssoConfig.organizationId, orgId));
        } else {
          await db.insert(ssoConfig).values({
            organizationId: orgId,
            provider,
            entityId,
            ssoUrl,
            certificate,
            metadataUrl,
            enforced: enforced ?? false,
            allowedDomains: allowedDomains ?? [],
          });
        }

        await logSettingsChanged(userId, orgId, ["sso"]);
        return Response.json({ success: true });
      }

      case "update_2fa": {
        const { required } = body as { required: boolean };

        const org = await db.query.organization.findFirst({
          where: eq(organization.id, orgId),
          columns: { settings: true },
        });

        const currentSettings = (org?.settings ?? {}) as Record<string, unknown>;

        await db
          .update(organization)
          .set({
            settings: { ...currentSettings, twoFactorRequired: required },
          })
          .where(eq(organization.id, orgId));

        await logSettingsChanged(userId, orgId, ["twoFactorRequired"]);
        return Response.json({ success: true });
      }

      case "add_ip": {
        const { cidr, description } = body as { cidr: string; description?: string };

        if (!cidr?.trim()) {
          return Response.json({ error: "CIDR is required" }, { status: 400 });
        }

        // Basic CIDR format validation
        const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
        if (!cidrRegex.test(cidr.trim())) {
          return Response.json({ error: "Invalid CIDR format (e.g. 192.168.1.0/24)" }, { status: 400 });
        }

        const [rule] = await db
          .insert(ipAllowlist)
          .values({
            organizationId: orgId,
            cidr: cidr.trim(),
            description: description?.trim() || null,
            createdByUserId: userId,
          })
          .returning();

        await logSettingsChanged(userId, orgId, ["ipAllowlist"]);
        return Response.json({ rule }, { status: 201 });
      }

      case "remove_ip": {
        const { ruleId } = body as { ruleId: string };

        if (!ruleId) {
          return Response.json({ error: "ruleId is required" }, { status: 400 });
        }

        await db
          .delete(ipAllowlist)
          .where(
            and(
              eq(ipAllowlist.id, ruleId),
              eq(ipAllowlist.organizationId, orgId)
            )
          );

        await logSettingsChanged(userId, orgId, ["ipAllowlist"]);
        return Response.json({ success: true });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    return handleAuthError(error);
  }
}
