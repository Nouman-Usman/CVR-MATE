import "server-only";

import { and, asc, eq, gte, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db";
import { quote } from "@/db/schema";

import { daysBetweenDates, toDateOnly } from "../time";
import type { FollowUpSignal, SignalContext } from "../types";

/**
 * A quote that ran out of time without the customer ever answering.
 *
 * This signal exists because of a side effect of another job.
 * `/api/cron/expire-documents` runs at 02:00 and flips `sent → expired` for any
 * quote past `validUntil`. Without this, a quote that had been climbing the
 * queue for a fortnight would drop out of it overnight — at the exact moment it
 * became most urgent, and silently, because nothing errors.
 *
 * Weighted ABOVE `unanswered_quote`: an expired quote is a lost opportunity
 * that is still recoverable by picking up the phone, whereas a live one is
 * merely waiting. It stops nagging after `quoteExpiredLookbackDays` — past that
 * the deal is cold and the queue should not carry it forever.
 */

interface ExpiredQuoteRow {
  id: string;
  companyId: string;
  dealId: string | null;
  number: string;
  total: number;
  validUntil: string | null;
}

export const quoteExpiredUnansweredSignal: FollowUpSignal<ExpiredQuoteRow> = {
  key: "quote_expired_unanswered",
  baseWeight: 55,

  async select(ctx: SignalContext) {
    const lookbackStart = toDateOnly(
      new Date(ctx.now.getTime() - ctx.config.quoteExpiredLookbackDays * 86_400_000)
    );

    return db
      .select({
        id: quote.id,
        companyId: quote.companyId,
        dealId: quote.dealId,
        number: quote.number,
        total: quote.total,
        validUntil: quote.validUntil,
      })
      .from(quote)
      .where(
        and(
          eq(quote.organizationId, ctx.organizationId),
          eq(quote.status, "expired"),
          isNull(quote.deletedAt),
          // Was actually sent to someone, and they never said yes or no.
          isNotNull(quote.sentAt),
          isNull(quote.acceptedAt),
          isNull(quote.rejectedAt),
          gte(quote.validUntil, lookbackStart)
        )
      )
      .orderBy(asc(quote.validUntil))
      .limit(ctx.limit);
  },

  evaluate(row, ctx) {
    if (!row.validUntil) return null;
    const today = toDateOnly(ctx.now);
    const daysExpired = daysBetweenDates(row.validUntil, today);
    // Not actually expired yet — `unanswered_quote` owns it until it is.
    if (daysExpired <= 0) return null;
    if (daysExpired > ctx.config.quoteExpiredLookbackDays) return null;

    return {
      companyId: row.companyId,
      dealId: row.dealId,
      signalKey: "quote_expired_unanswered",
      entityId: row.id,
      reason: { key: "quoteExpiredUnanswered", params: { number: row.number, days: daysExpired } },
      // Front-loaded: the first few days after expiry are when a call still
      // reads as attentive rather than late.
      urgency: Math.max(0, 25 - daysExpired),
      daysDelta: daysExpired,
      amountOre: row.total,
      action: { kind: "open_quote", quoteId: row.id },
    };
  },
};
