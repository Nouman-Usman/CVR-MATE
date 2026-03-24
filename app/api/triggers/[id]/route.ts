import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { leadTrigger } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Only allow updating own triggers
    const existing = await db.query.leadTrigger.findFirst({
      where: and(
        eq(leadTrigger.id, id),
        eq(leadTrigger.userId, session.user.id)
      ),
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.filters !== undefined) updates.filters = body.filters;
    if (body.frequency !== undefined) updates.frequency = body.frequency;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.notificationChannels !== undefined)
      updates.notificationChannels = body.notificationChannels;

    const [updated] = await db
      .update(leadTrigger)
      .set(updates)
      .where(
        and(eq(leadTrigger.id, id), eq(leadTrigger.userId, session.user.id))
      )
      .returning();

    return NextResponse.json({ trigger: updated });
  } catch (error) {
    console.error("Failed to update trigger:", error);
    return NextResponse.json(
      { error: "Failed to update trigger" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.query.leadTrigger.findFirst({
      where: and(
        eq(leadTrigger.id, id),
        eq(leadTrigger.userId, session.user.id)
      ),
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db
      .delete(leadTrigger)
      .where(
        and(eq(leadTrigger.id, id), eq(leadTrigger.userId, session.user.id))
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete trigger:", error);
    return NextResponse.json(
      { error: "Failed to delete trigger" },
      { status: 500 }
    );
  }
}
