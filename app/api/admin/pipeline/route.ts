import { NextRequest } from "next/server";
import { db } from "@/db";
import { pipelineStage } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getAuthContext, handleAuthError } from "@/lib/auth-context";

// GET /api/admin/pipeline — list pipeline stages for org
export async function GET() {
  try {
    const { orgId } = await getAuthContext({ resource: "settings", action: "read" });

    const stages = await db.query.pipelineStage.findMany({
      where: eq(pipelineStage.organizationId, orgId),
      orderBy: [asc(pipelineStage.position)],
    });

    return Response.json({ stages });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST /api/admin/pipeline — create a pipeline stage
export async function POST(request: NextRequest) {
  try {
    const { orgId } = await getAuthContext({ resource: "settings", action: "create" });

    const body = await request.json();
    const { name, slug, color, position } = body as {
      name: string;
      slug: string;
      color?: string;
      position?: number;
    };

    if (!name?.trim() || !slug?.trim()) {
      return Response.json({ error: "Name and slug are required" }, { status: 400 });
    }

    // Auto-position at end if not specified
    let pos = position;
    if (pos === undefined) {
      const existing = await db.query.pipelineStage.findMany({
        where: eq(pipelineStage.organizationId, orgId),
        columns: { position: true },
        orderBy: [asc(pipelineStage.position)],
      });
      pos = existing.length > 0 ? Math.max(...existing.map((s) => s.position)) + 1 : 0;
    }

    const [stage] = await db
      .insert(pipelineStage)
      .values({
        organizationId: orgId,
        name: name.trim(),
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        color: color || null,
        position: pos,
      })
      .returning();

    return Response.json({ stage }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}

// PATCH /api/admin/pipeline — update a stage or reorder stages
export async function PATCH(request: NextRequest) {
  try {
    const { orgId } = await getAuthContext({ resource: "settings", action: "update" });

    const body = await request.json();

    // Batch reorder: { reorder: [{ id, position }] }
    if (body.reorder && Array.isArray(body.reorder)) {
      for (const item of body.reorder) {
        await db
          .update(pipelineStage)
          .set({ position: item.position })
          .where(
            and(
              eq(pipelineStage.id, item.id),
              eq(pipelineStage.organizationId, orgId)
            )
          );
      }
      return Response.json({ success: true });
    }

    // Single update: { stageId, name?, slug?, color?, position? }
    const { stageId, name, slug, color, position: pos } = body;

    if (!stageId) {
      return Response.json({ error: "stageId is required" }, { status: 400 });
    }

    const existing = await db.query.pipelineStage.findFirst({
      where: and(
        eq(pipelineStage.id, stageId),
        eq(pipelineStage.organizationId, orgId)
      ),
    });

    if (!existing) {
      return Response.json({ error: "Stage not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (slug !== undefined) updates.slug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (color !== undefined) updates.color = color;
    if (pos !== undefined) updates.position = pos;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    await db.update(pipelineStage).set(updates).where(eq(pipelineStage.id, stageId));

    return Response.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}

// DELETE /api/admin/pipeline — delete a pipeline stage
export async function DELETE(request: NextRequest) {
  try {
    const { orgId } = await getAuthContext({ resource: "settings", action: "delete" });

    const url = new URL(request.url);
    const stageId = url.searchParams.get("stageId");

    if (!stageId) {
      return Response.json({ error: "stageId is required" }, { status: 400 });
    }

    const existing = await db.query.pipelineStage.findFirst({
      where: and(
        eq(pipelineStage.id, stageId),
        eq(pipelineStage.organizationId, orgId)
      ),
    });

    if (!existing) {
      return Response.json({ error: "Stage not found" }, { status: 404 });
    }

    await db.delete(pipelineStage).where(eq(pipelineStage.id, stageId));

    return Response.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
