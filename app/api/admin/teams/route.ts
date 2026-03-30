import { NextRequest } from "next/server";
import { db } from "@/db";
import { team, teamMember, user } from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { getAuthContext, handleAuthError } from "@/lib/auth-context";

// GET /api/admin/teams — list org teams with member counts
export async function GET() {
  try {
    const { orgId } = await getAuthContext({ resource: "members", action: "read" });

    const teams = await db
      .select({
        id: team.id,
        name: team.name,
        description: team.description,
        leadUserId: team.leadUserId,
        color: team.color,
        createdAt: team.createdAt,
        leadName: user.name,
      })
      .from(team)
      .leftJoin(user, eq(team.leadUserId, user.id))
      .where(eq(team.organizationId, orgId))
      .orderBy(desc(team.createdAt));

    // Get member counts per team
    const memberCounts = await db
      .select({
        teamId: teamMember.teamId,
        count: count(),
      })
      .from(teamMember)
      .where(
        eq(
          teamMember.teamId,
          // Filter to this org's teams only
          db
            .select({ id: team.id })
            .from(team)
            .where(eq(team.organizationId, orgId))
            .limit(1) as any
        )
      )
      .groupBy(teamMember.teamId);

    const countMap = new Map(memberCounts.map((c) => [c.teamId, c.count]));

    const result = teams.map((t) => ({
      ...t,
      memberCount: countMap.get(t.id) ?? 0,
    }));

    return Response.json({ teams: result });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST /api/admin/teams — create a team
export async function POST(request: NextRequest) {
  try {
    const { orgId } = await getAuthContext({ resource: "members", action: "create" });

    const body = await request.json();
    const { name, description, leadUserId, color } = body as {
      name: string;
      description?: string;
      leadUserId?: string;
      color?: string;
    };

    if (!name?.trim()) {
      return Response.json({ error: "Team name is required" }, { status: 400 });
    }

    const [newTeam] = await db
      .insert(team)
      .values({
        organizationId: orgId,
        name: name.trim(),
        description: description?.trim() || null,
        leadUserId: leadUserId || null,
        color: color || null,
      })
      .returning();

    return Response.json({ team: newTeam }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}

// PATCH /api/admin/teams — update a team
export async function PATCH(request: NextRequest) {
  try {
    const { orgId } = await getAuthContext({ resource: "members", action: "update" });

    const body = await request.json();
    const { teamId, name, description, leadUserId, color } = body as {
      teamId: string;
      name?: string;
      description?: string;
      leadUserId?: string | null;
      color?: string | null;
    };

    if (!teamId) {
      return Response.json({ error: "teamId is required" }, { status: 400 });
    }

    const existing = await db.query.team.findFirst({
      where: and(eq(team.id, teamId), eq(team.organizationId, orgId)),
    });

    if (!existing) {
      return Response.json({ error: "Team not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (leadUserId !== undefined) updates.leadUserId = leadUserId;
    if (color !== undefined) updates.color = color;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    await db.update(team).set(updates).where(eq(team.id, teamId));

    return Response.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}

// DELETE /api/admin/teams — delete a team
export async function DELETE(request: NextRequest) {
  try {
    const { orgId } = await getAuthContext({ resource: "members", action: "delete" });

    const url = new URL(request.url);
    const teamId = url.searchParams.get("teamId");

    if (!teamId) {
      return Response.json({ error: "teamId is required" }, { status: 400 });
    }

    const existing = await db.query.team.findFirst({
      where: and(eq(team.id, teamId), eq(team.organizationId, orgId)),
    });

    if (!existing) {
      return Response.json({ error: "Team not found" }, { status: 404 });
    }

    await db.delete(team).where(eq(team.id, teamId));

    return Response.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
