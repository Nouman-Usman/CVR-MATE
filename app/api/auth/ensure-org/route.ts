import { headers } from "next/headers";
import { db } from "@/db";
import { member, organization } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

/**
 * POST /api/auth/ensure-org
 *
 * Ensures the authenticated user has at least one organization.
 * If not, creates a personal workspace and sets it as active.
 * Called after signup and login to guarantee org context exists.
 */
export async function POST() {
  try {
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if user already has any org membership
    const existingMembership = await db.query.member.findFirst({
      where: eq(member.userId, userId),
      columns: { organizationId: true },
    });

    if (existingMembership) {
      // User has an org — ensure one is set as active
      if (!session.session.activeOrganizationId) {
        await auth.api.setActiveOrganization({
          headers: hdrs,
          body: { organizationId: existingMembership.organizationId },
        });
      }

      return Response.json({
        created: false,
        organizationId: session.session.activeOrganizationId || existingMembership.organizationId,
      });
    }

    // No org — create a personal workspace
    const userName = session.user.name || "User";
    const orgName = `${userName}'s Workspace`;
    const slug = `${userName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;

    const result = await auth.api.createOrganization({
      headers: hdrs,
      body: {
        name: orgName,
        slug,
      },
    });

    if (result?.id) {
      // Mark as personal org
      await db
        .update(organization)
        .set({
          type: "personal",
          ownerId: userId,
        })
        .where(eq(organization.id, result.id));

      // Set as active
      await auth.api.setActiveOrganization({
        headers: hdrs,
        body: { organizationId: result.id },
      });
    }

    return Response.json({
      created: true,
      organizationId: result?.id,
    });
  } catch (error) {
    console.error("[ensure-org] Failed:", error);
    return Response.json(
      { error: "Failed to ensure organization" },
      { status: 500 }
    );
  }
}
