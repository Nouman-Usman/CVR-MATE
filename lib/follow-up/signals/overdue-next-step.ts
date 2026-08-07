import "server-only";

import { and, asc, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { interaction, todo } from "@/db/schema";

import { daysBetweenDates, toDateOnly } from "../time";
import type { FollowUpSignal, SignalContext } from "../types";

/**
 * A next step the rep committed to and has not done.
 *
 * The strongest signal in the registry, because it is the only one where a
 * human explicitly said "I will do this by then". Everything else is inference.
 *
 * Reads `interaction`, not `todo`, for two reasons: `todo` has no `dealId`
 * column at all (only `companyId` and `interactionId`), so it cannot be mapped
 * to a card; and `interaction.nextStep` is the commitment itself, whereas the
 * todo is a reminder that a user is free to delete.
 *
 * The engine NEVER writes to `todo`. `syncFollowUpTodo` in
 * `lib/crm/interactions.ts` remains its only writer, guarded by the
 * `todo_interaction_live_uq` partial index. This signal only reads the todo to
 * learn whether the work is done — `isCompleted` is the single source of truth,
 * so ticking it off in `/todos` clears the queue item with no syncing at all.
 */

interface OverdueNextStepRow {
  id: string;
  companyId: string;
  dealId: string | null;
  nextStep: string | null;
  nextStepAt: string | null;
  todoId: string | null;
  todoCompleted: boolean | null;
}

export const overdueNextStepSignal: FollowUpSignal<OverdueNextStepRow> = {
  key: "overdue_next_step",
  baseWeight: 50,

  async select(ctx: SignalContext) {
    const today = toDateOnly(ctx.now);
    return db
      .select({
        id: interaction.id,
        companyId: interaction.companyId,
        dealId: interaction.dealId,
        nextStep: interaction.nextStep,
        nextStepAt: interaction.nextStepAt,
        todoId: todo.id,
        todoCompleted: todo.isCompleted,
      })
      .from(interaction)
      // At most one live todo per interaction (todo_interaction_live_uq), so
      // this cannot fan the result set out.
      .leftJoin(
        todo,
        and(eq(todo.interactionId, interaction.id), isNull(todo.deletedAt))
      )
      .where(
        and(
          eq(interaction.organizationId, ctx.organizationId),
          isNull(interaction.deletedAt),
          isNotNull(interaction.nextStepAt),
          lt(interaction.nextStepAt, today),
          sql`length(trim(coalesce(${interaction.nextStep}, ''))) > 0`
        )
      )
      .orderBy(asc(interaction.nextStepAt))
      .limit(ctx.limit);
  },

  evaluate(row, ctx) {
    if (!row.nextStepAt || !row.nextStep) return null;
    // Done is done, wherever the user ticked it.
    if (row.todoCompleted) return null;

    const today = toDateOnly(ctx.now);
    const days = daysBetweenDates(row.nextStepAt, today);
    if (days <= 0) return null;

    return {
      companyId: row.companyId,
      dealId: row.dealId,
      signalKey: "overdue_next_step",
      entityId: row.id,
      reason: { key: "overdueNextStep", params: { step: row.nextStep, days } },
      // Climbs twice as fast as staleness: a missed commitment gets worse
      // quicker than a quiet deal does.
      urgency: Math.min(30, days * 2),
      daysDelta: days,
      amountOre: null,
      // Only offer "Mark done" when a live todo actually exists. An interaction
      // whose reminder was deleted still fires — the commitment is real — but
      // there is nothing to tick, so the card falls back to logging.
      action: row.todoId ? { kind: "complete_todo", todoId: row.todoId } : undefined,
    };
  },
};
