import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { member, invitation, user, organization } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuthContext, handleAuthError, type OrgRole } from "@/lib/auth-context";
import { checkSeatLimit } from "@/lib/stripe/entitlements";
import { canManageRole } from "@/lib/permissions";
import { logMemberInvited, logMemberRemoved, logRoleChanged } from "@/lib/audit";
import { auth } from "@/lib/auth";

// GET /api/admin/members — list org members + pending invitations
export async function GET() {
  try {
    const { orgId } = await getAuthContext({ resource: "members", action: "read" });

    const members = await db
      .select({
        id: member.id,
        userId: member.userId,
        role: member.role,
        teamId: member.teamId,
        lastActiveAt: member.lastActiveAt,
        createdAt: member.createdAt,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, orgId))
      .orderBy(desc(member.createdAt));

    const invitations = await db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        inviterName: user.name,
      })
      .from(invitation)
      .innerJoin(user, eq(invitation.inviterId, user.id))
      .where(
        and(
          eq(invitation.organizationId, orgId),
          eq(invitation.status, "pending")
        )
      )
      .orderBy(desc(invitation.createdAt));

    return Response.json({ members, invitations });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST /api/admin/members — invite a new member
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId, role: actorRole } = await getAuthContext({
      resource: "members",
      action: "create",
    });

    const body = await request.json();
    const { email, role } = body as { email: string; role: string };

    if (!email || !role) {
      return Response.json({ error: "Email and role are required" }, { status: 400 });
    }

    // Validate role
    const validRoles: OrgRole[] = ["admin", "manager", "member", "viewer"];
    if (!validRoles.includes(role as OrgRole)) {
      return Response.json({ error: "Invalid role" }, { status: 400 });
    }

    // Can't invite someone with a role >= your own
    if (!canManageRole(actorRole, role as OrgRole)) {
      return Response.json(
        { error: "Cannot invite a member with a role equal to or above your own" },
        { status: 403 }
      );
    }

    // Check seat limit
    const { allowed, maxSeats, currentSeats } = await checkSeatLimit(orgId);
    if (!allowed) {
      return Response.json(
        { error: `Seat limit reached (${currentSeats}/${maxSeats}). Upgrade your plan.` },
        { status: 403 }
      );
    }

    // Use Better Auth's invitation API
    const hdrs = await headers();
    const result = await auth.api.createInvitation({
      headers: hdrs,
      body: {
        organizationId: orgId,
        email,
        role: role as "admin" | "member" | "owner",
      },
    });

    await logMemberInvited(userId, orgId, email, role);

    return Response.json({ invitation: result }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}

// PATCH /api/admin/members — change a member's role
export async function PATCH(request: NextRequest) {
  try {
    const { userId, orgId, role: actorRole } = await getAuthContext({
      resource: "members",
      action: "update",
    });

    const body = await request.json();
    const { memberId, newRole } = body as { memberId: string; newRole: string };

    if (!memberId || !newRole) {
      return Response.json({ error: "memberId and newRole are required" }, { status: 400 });
    }

    // Get the target member
    const target = await db.query.member.findFirst({
      where: and(eq(member.id, memberId), eq(member.organizationId, orgId)),
    });

    if (!target) {
      return Response.json({ error: "Member not found" }, { status: 404 });
    }

    // Can't change owner role
    if (target.role === "owner") {
      return Response.json({ error: "Cannot change the owner's role" }, { status: 403 });
    }

    // Can't promote to a role >= your own
    if (!canManageRole(actorRole, newRole as OrgRole)) {
      return Response.json({ error: "Cannot assign a role equal to or above your own" }, { status: 403 });
    }

    const oldRole = target.role;

    await db
      .update(member)
      .set({ role: newRole })
      .where(eq(member.id, memberId));

    await logRoleChanged(userId, orgId, target.userId, oldRole, newRole);

    return Response.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}

// DELETE /api/admin/members — remove a member
export async function DELETE(request: NextRequest) {
  try {
    const { userId, orgId, role: actorRole } = await getAuthContext({
      resource: "members",
      action: "delete",
    });

    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId");

    if (!memberId) {
      return Response.json({ error: "memberId is required" }, { status: 400 });
    }

    const target = await db.query.member.findFirst({
      where: and(eq(member.id, memberId), eq(member.organizationId, orgId)),
    });

    if (!target) {
      return Response.json({ error: "Member not found" }, { status: 404 });
    }

    if (target.role === "owner") {
      return Response.json({ error: "Cannot remove the organization owner" }, { status: 403 });
    }

    if (!canManageRole(actorRole, target.role as OrgRole)) {
      return Response.json({ error: "Cannot remove a member with a role equal to or above your own" }, { status: 403 });
    }

    await db.delete(member).where(eq(member.id, memberId));

    await logMemberRemoved(userId, orgId, target.userId);

    return Response.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
