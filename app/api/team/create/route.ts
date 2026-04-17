export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organization, member } from "@/db/auth-schema";
import crypto from "crypto";
import { assertCanCreateOrg, TeamPermissionError, teamErrorToStatus } from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized, badRequest } from "@/lib/team/session";

export async function POST(req: NextRequest) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { name, slug } = body as { name?: string; slug?: string };

  if (!name?.trim()) return badRequest("Organization name is required");

  // Plan enforcement — only Enterprise can create orgs
  try {
    await assertCanCreateOrg(session.user.id);
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: teamErrorToStatus(err) });
    }
    throw err;
  }

  // Generate slug from name if not provided
  const orgSlug =
    slug?.trim() ||
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") ||
    `org-${Date.now()}`;

  // Create org + owner membership in a transaction
  const orgId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(organization).values({
        id: orgId,
        name: name.trim(),
        slug: orgSlug,
      });

      await tx.insert(member).values({
        id: memberId,
        organizationId: orgId,
        userId: session.user.id,
        role: "owner",
      });
    });

    await logOrgEvent({
      organizationId: orgId,
      actorId: session.user.id,
      action: "org_created",
      metadata: { name: name.trim(), slug: orgSlug },
    });

    return NextResponse.json({ id: orgId, name: name.trim(), slug: orgSlug });
  } catch (err) {
    console.error("[team/create] Failed:", err);
    // Slug uniqueness conflict
    if (err instanceof Error && err.message.includes("unique")) {
      return NextResponse.json(
        { error: "An organization with this slug already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
}
