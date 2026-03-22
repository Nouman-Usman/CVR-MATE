import { NextRequest, NextResponse } from "next/server";
import { eq, asc, desc } from "drizzle-orm";
import { todo } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const todos = await db.query.todo.findMany({
      where: eq(todo.userId, session.user.id),
      with: { company: true },
      orderBy: [asc(todo.isCompleted), desc(todo.createdAt)],
    });

    return NextResponse.json({ todos });
  } catch (error) {
    console.error("Failed to fetch todos:", error);
    return NextResponse.json(
      { error: "Failed to fetch todos" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, priority, companyId, dueDate } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const [newTodo] = await db
      .insert(todo)
      .values({
        userId: session.user.id,
        title: title.trim(),
        description: description ?? null,
        priority: priority ?? "medium",
        companyId: companyId ?? null,
        dueDate: dueDate ?? null,
      })
      .returning();

    // Re-fetch with company relation
    const todoWithCompany = await db.query.todo.findFirst({
      where: eq(todo.id, newTodo.id),
      with: { company: true },
    });

    return NextResponse.json({ todo: todoWithCompany }, { status: 201 });
  } catch (error) {
    console.error("Failed to create todo:", error);
    return NextResponse.json(
      { error: "Failed to create todo" },
      { status: 500 }
    );
  }
}
