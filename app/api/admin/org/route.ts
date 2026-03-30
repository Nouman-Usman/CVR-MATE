import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { organization, member } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthContext, handleAuthError } from "@/lib/auth-context";
import { auth } from "@/lib/auth";
import { logSettingsChanged } from "@/lib/audit";

// GET /api/admin/org — get current org settings
export async function GET() {
  try {
    const { orgId } = await getAuthContext({ resource: "settings", action: "read" });

    const org = await db.query.organization.findFirst({
      where: eq(organization.id, orgId),
    });

    if (!org) {
      return Response.json({ error: "Organization not found" }, { status: 404 });
    }

    return Response.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      type: org.type,
      billingEmail: org.billingEmail,
      maxSeats: org.maxSeats,
      settings: org.settings,
      createdAt: org.createdAt,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST /api/admin/org — create a new organization
export async function POST(request: NextRequest) {
  try {
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body as { name: string };

    if (!name?.trim()) {
      return Response.json({ error: "Organization name is required" }, { status: 400 });
    }

    // Generate a slug from the name
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      || `org-${Date.now()}`;

    // Create org via Better Auth API
    const result = await auth.api.createOrganization({
      headers: hdrs,
      body: {
        name: name.trim(),
        slug,
      },
    });

    // Update the org type to 'team' (personal orgs are auto-created)
    if (result?.id) {
      await db
        .update(organization)
        .set({
          type: "team",
          ownerId: session.user.id,
        })
        .where(eq(organization.id, result.id));

      // Set as active org
      await auth.api.setActiveOrganization({
        headers: hdrs,
        body: { organizationId: result.id },
      });
    }

    return Response.json({ org: result }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}

// PATCH /api/admin/org — update org settings
export async function PATCH(request: NextRequest) {
  try {
    const { userId, orgId } = await getAuthContext({ resource: "settings", action: "update" });

    const body = await request.json();
    const { name, billingEmail, logo } = body as {
      name?: string;
      billingEmail?: string;
      logo?: string | null;
    };

    const updates: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (name !== undefined) {
      updates.name = name.trim();
      changedFields.push("name");
    }
    if (billingEmail !== undefined) {
      updates.billingEmail = billingEmail.trim() || null;
      changedFields.push("billingEmail");
    }
    if (logo !== undefined) {
      updates.logo = logo;
      changedFields.push("logo");
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    await db.update(organization).set(updates).where(eq(organization.id, orgId));

    if (changedFields.length > 0) {
      await logSettingsChanged(userId, orgId, changedFields);
    }

    return Response.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}

// DELETE /api/admin/org — delete organization
export async function DELETE() {
  try {
    const { userId, orgId, role } = await getAuthContext({ resource: "settings", action: "delete" });

    if (role !== "owner") {
      return Response.json({ error: "Only the organization owner can delete it" }, { status: 403 });
    }

    // Check if this is a personal org — can't delete personal workspace
    const org = await db.query.organization.findFirst({
      where: eq(organization.id, orgId),
      columns: { type: true },
    });

    if (org?.type === "personal") {
      return Response.json({ error: "Cannot delete your personal workspace" }, { status: 403 });
    }

    // Soft delete — mark as inactive
    await db
      .update(organization)
      .set({ isActive: false, deletedAt: new Date() })
      .where(eq(organization.id, orgId));

    return Response.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
