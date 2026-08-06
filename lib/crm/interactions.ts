import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { todo } from "@/db/schema";

/**
 * Keep an interaction's single follow-up todo in sync with its next-step.
 *
 * - next-step present  → upsert the linked todo (title = next-step, dueDate =
 *   next-step date). The todo appears in the user's /todos list and its .ics
 *   export — the "calendar" surface for follow-ups (no separate calendar sync).
 * - next-step cleared  → soft-delete the auto-created todo.
 *
 * Idempotent and concurrency-safe: the `todo_interaction_live_uq` partial unique
 * index guarantees at most one live todo per interaction, so this upserts rather
 * than reading first and then deciding — two concurrent PATCHes of the same
 * interaction previously raced and produced two follow-up todos.
 */
export async function syncFollowUpTodo(params: {
  interactionId: string;
  userId: string;
  organizationId: string;
  companyId: string;
  nextStep: string | null | undefined;
  nextStepAt: string | null | undefined; // "YYYY-MM-DD"
}): Promise<void> {
  const { interactionId, userId, organizationId, companyId, nextStep, nextStepAt } = params;

  const title = nextStep?.trim();

  if (!title) {
    // Next-step cleared — retire the auto-created todo. Safe to run repeatedly.
    await db
      .update(todo)
      .set({ deletedAt: new Date() })
      .where(and(eq(todo.interactionId, interactionId), isNull(todo.deletedAt)));
    return;
  }

  await db
    .insert(todo)
    .values({
      userId,
      organizationId,
      companyId,
      title,
      dueDate: nextStepAt ?? null,
      interactionId,
      priority: "medium",
    })
    .onConflictDoUpdate({
      target: todo.interactionId,
      // Must match todo_interaction_live_uq exactly or Postgres cannot pick the
      // index to arbitrate on.
      targetWhere: sql`${todo.interactionId} is not null and ${todo.deletedAt} is null`,
      set: { title, dueDate: nextStepAt ?? null },
    });
}
