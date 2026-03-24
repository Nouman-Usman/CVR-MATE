import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { todo, company } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cacheDel } from "@/lib/redis";
import { cacheKey } from "@/lib/cache";

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
    const { title, description, isCompleted, priority, companyId, cvr, dueDate } =
      body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (isCompleted !== undefined) updateData.isCompleted = isCompleted;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate;

    // Resolve company: direct companyId takes priority, then CVR lookup
    if (companyId !== undefined) {
      updateData.companyId = companyId;
    } else if (cvr !== undefined) {
      if (cvr === null || cvr === "") {
        updateData.companyId = null;
      } else {
        const existing = await db.query.company.findFirst({
          where: eq(company.vat, cvr.trim()),
          columns: { id: true },
        });
        if (existing) {
          updateData.companyId = existing.id;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(todo)
      .set(updateData)
      .where(and(eq(todo.id, id), eq(todo.userId, session.user.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    // Re-fetch with company relation
    const todoWithCompany = await db.query.todo.findFirst({
      where: eq(todo.id, updated.id),
      with: { company: true },
    });

    // Invalidate cache
    await cacheDel(cacheKey.todos(session.user.id));

    return NextResponse.json({ todo: todoWithCompany });
  } catch (error) {
    console.error("Failed to update todo:", error);
    return NextResponse.json(
      { error: "Failed to update todo" },
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

    const [deleted] = await db
      .delete(todo)
      .where(and(eq(todo.id, id), eq(todo.userId, session.user.id)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    // Invalidate cache
    await cacheDel(cacheKey.todos(session.user.id));

    return NextResponse.json({ message: "Todo deleted" });
  } catch (error) {
    console.error("Failed to delete todo:", error);
    return NextResponse.json(
      { error: "Failed to delete todo" },
      { status: 500 }
    );
  }
}
