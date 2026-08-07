import "server-only";

import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { contract } from "@/db/schema";

import { daysBetweenDates, toDateOnly } from "../time";
import type { FollowUpSignal, SignalContext } from "../types";

/**
 * A contract entering — or already past — its renewal notice window.
 *
 * Matches `status IN ('active','expired')`, which fixes a real bug in
 * `/api/cron/contract-renewals`. That job filters on `status='active'` and runs
 * at 07:00, but `/api/cron/expire-documents` demotes overdue contracts to
 * `'expired'` at 02:00 — five hours earlier. Its `daysLeft < 0` branch
 * ("Expired on … — action needed") is therefore unreachable in steady state,
 * and a contract entered with an already-past expiry is never surfaced at all.
 *
 * This signal deliberately ignores `contract.renewalNotifiedAt`. That column is
 * the other job's claim stamp; reading it here would couple two schedules and
 * make "did the rep already hear about this" depend on cron ordering. The queue
 * has its own suppression via `follow_up_state`.
 */

const RENEWABLE_STATUSES = ["active", "expired"] as const;

interface ContractRow {
  id: string;
  companyId: string;
  dealId: string | null;
  title: string;
  value: number | null;
  expiryDate: string | null;
}

export const contractRenewalSignal: FollowUpSignal<ContractRow> = {
  key: "contract_renewal",
  baseWeight: 35,

  async select(ctx: SignalContext) {
    const grace = Math.trunc(ctx.config.renewalGraceDays);
    return db
      .select({
        id: contract.id,
        companyId: contract.companyId,
        dealId: contract.dealId,
        title: contract.title,
        value: contract.value,
        expiryDate: contract.expiryDate,
      })
      .from(contract)
      .where(
        and(
          eq(contract.organizationId, ctx.organizationId),
          inArray(contract.status, [...RENEWABLE_STATUSES]),
          isNull(contract.deletedAt),
          isNotNull(contract.expiryDate),
          // Each contract carries its own notice period, so the window is
          // per-row rather than a global constant.
          sql`${contract.expiryDate} <= current_date + ${contract.renewalNoticeDays} + cast(${grace} as integer)`
        )
      )
      .orderBy(asc(contract.expiryDate))
      .limit(ctx.limit);
  },

  evaluate(row, ctx) {
    if (!row.expiryDate) return null;
    const today = toDateOnly(ctx.now);
    const daysToExpiry = daysBetweenDates(today, row.expiryDate);
    const overdue = daysToExpiry < 0;

    return {
      companyId: row.companyId,
      dealId: row.dealId,
      signalKey: "contract_renewal",
      entityId: row.id,
      reason: overdue
        ? {
            key: "contractExpired",
            params: { title: row.title, date: row.expiryDate, days: -daysToExpiry },
          }
        : {
            key: "contractRenewal",
            params: { title: row.title, date: row.expiryDate, days: daysToExpiry },
          },
      // Already lapsed outranks merely approaching; within each case, sooner
      // (or longer lapsed) is more urgent.
      urgency: overdue
        ? Math.min(30, 20 + -daysToExpiry)
        : Math.max(0, 20 - daysToExpiry),
      daysDelta: -daysToExpiry,
      amountOre: row.value,
      action: { kind: "open_contract", contractId: row.id },
    };
  },
};
