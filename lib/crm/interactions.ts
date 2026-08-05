import "server-only";

import { and, eq, isNull } from "drizzle-orm";
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
 * Idempotent: at most one live todo per interaction (matched on interactionId).
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

  const existing = await db.query.todo.findFirst({
    where: and(eq(todo.interactionId, interactionId), isNull(todo.deletedAt)),
    columns: { id: true },
  });

  const title = nextStep?.trim();
  if (title) {
    if (existing) {
      await db
        .update(todo)
        .set({ title, dueDate: nextStepAt ?? null })
        .where(eq(todo.id, existing.id));
    } else {
      await db.insert(todo).values({
        userId,
        organizationId,
        companyId,
        title,
        dueDate: nextStepAt ?? null,
        interactionId,
        priority: "medium",
      });
    }
  } else if (existing) {
    await db.update(todo).set({ deletedAt: new Date() }).where(eq(todo.id, existing.id));
  }
}
