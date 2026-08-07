import "server-only";

import { and, asc, eq, isNull, lt } from "drizzle-orm";

import { db } from "@/db";
import { quote } from "@/db/schema";

import { daysAgo, daysBetweenDates, daysSinceInstant, toDateOnly } from "../time";
import type { FollowUpSignal, SignalContext } from "../types";

/**
 * A quote sent to a customer that nobody has chased.
 *
 * Escalates as `validUntil` approaches, because the window to save the deal is
 * closing: once the date passes, `/api/cron/expire-documents` flips the status
 * to `expired` at 02:00 and the quote leaves this signal entirely. The
 * `quote_expired_unanswered` signal picks it up from there — without it, the
 * most urgent quote in the system would silently vanish from the queue on the
 * exact day it mattered most.
 */

interface UnansweredQuoteRow {
  id: string;
  companyId: string;
  dealId: string | null;
  number: string;
  total: number;
  sentAt: Date | null;
  validUntil: string | null;
}

export const unansweredQuoteSignal: FollowUpSignal<UnansweredQuoteRow> = {
  key: "unanswered_quote",
  baseWeight: 40,

  async select(ctx: SignalContext) {
    const cutoff = daysAgo(ctx.now, ctx.config.quoteSilentDays);
    return db
      .select({
        id: quote.id,
        companyId: quote.companyId,
        dealId: quote.dealId,
        number: quote.number,
        total: quote.total,
        sentAt: quote.sentAt,
        validUntil: quote.validUntil,
      })
      .from(quote)
      .where(
        and(
          eq(quote.organizationId, ctx.organizationId),
          eq(quote.status, "sent"),
          isNull(quote.deletedAt),
          lt(quote.sentAt, cutoff)
        )
      )
      .orderBy(asc(quote.sentAt))
      .limit(ctx.limit);
  },

  evaluate(row, ctx) {
    if (!row.sentAt) return null;
    const daysSilent = daysSinceInstant(row.sentAt, ctx.now);
    if (daysSilent < ctx.config.quoteSilentDays) return null;

    const today = toDateOnly(ctx.now);
    const daysToExpiry = row.validUntil ? daysBetweenDates(today, row.validUntil) : null;
    const expiringSoon =
      daysToExpiry !== null &&
      daysToExpiry >= 0 &&
      daysToExpiry <= ctx.config.quoteExpiryWarnDays;

    // Silence saturates at 20 so a quote ignored for a year cannot crowd out
    // everything else.
    const silenceUrgency = Math.min(20, daysSilent - ctx.config.quoteSilentDays);

    // The deadline sets a FLOOR rather than adding a bonus, and that floor
    // starts above the silence ceiling. An additive bonus is not enough: a
    // quote quiet for 30 days (silence 20) would outrank one quiet for 6 days
    // that expires in 2 (1 + bonus), which is precisely backwards — the second
    // one is the one you can still save.
    const expiryUrgency =
      daysToExpiry === null ? 0 : 25 + (ctx.config.quoteExpiryWarnDays - daysToExpiry) * 5;

    return {
      companyId: row.companyId,
      dealId: row.dealId,
      signalKey: "unanswered_quote",
      entityId: row.id,
      reason: expiringSoon
        ? { key: "quoteExpiringSoon", params: { number: row.number, days: daysToExpiry } }
        : { key: "unansweredQuote", params: { number: row.number, days: daysSilent } },
      urgency: expiringSoon
        ? Math.min(50, Math.max(silenceUrgency, expiryUrgency))
        : silenceUrgency,
      daysDelta: daysSilent,
      amountOre: row.total,
      action: { kind: "open_quote", quoteId: row.id },
    };
  },
};
