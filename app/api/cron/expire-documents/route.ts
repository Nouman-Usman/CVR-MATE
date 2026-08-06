import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { quote, contract } from "@/db/schema";
import { verifyCronRequest } from "@/lib/cron/verify";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron: retire documents whose own dates say they are no longer live.
 *
 * Both statuses existed but nothing ever assigned them, which made two fields
 * decorative and one report wrong:
 *
 *  - `quote.status = 'expired'` was in the check constraint and assigned by
 *    nothing, so `validUntil` was advisory. The accept path now refuses an
 *    expired quote outright (that is the real guard); this sweep exists so the
 *    *list* tells the truth without someone attempting an accept first.
 *
 *  - `contract.status` never moved off 'active', so every `status = 'active'`
 *    filter — including the renewal cron's own — counted long-expired contracts
 *    forever.
 *
 * Set-based: two UPDATEs, no row loop, naturally idempotent because each
 * predicate excludes rows it has already changed.
 */

interface SweepResult {
  quotesExpired: number;
  contractsExpired: number;
  dryRun: boolean;
}

async function sweep(dryRun: boolean): Promise<SweepResult> {
  if (dryRun) {
    const [quotes, contracts] = await Promise.all([
      db
        .select({ id: quote.id })
        .from(quote)
        .where(
          and(
            eq(quote.status, "sent"),
            isNull(quote.deletedAt),
            isNotNull(quote.validUntil),
            sql`${quote.validUntil} < current_date`
          )
        ),
      db
        .select({ id: contract.id })
        .from(contract)
        .where(
          and(
            eq(contract.status, "active"),
            isNull(contract.deletedAt),
            isNotNull(contract.expiryDate),
            sql`${contract.expiryDate} < current_date`
          )
        ),
    ]);
    return { quotesExpired: quotes.length, contractsExpired: contracts.length, dryRun };
  }

  // Only 'sent' quotes expire. A draft past its date is still editable, and an
  // accepted or converted one is a commitment that a date cannot revoke.
  const expiredQuotes = await db
    .update(quote)
    .set({ status: "expired" })
    .where(
      and(
        eq(quote.status, "sent"),
        isNull(quote.deletedAt),
        isNotNull(quote.validUntil),
        sql`${quote.validUntil} < current_date`
      )
    )
    .returning({ id: quote.id });

  const expiredContracts = await db
    .update(contract)
    .set({ status: "expired" })
    .where(
      and(
        eq(contract.status, "active"),
        isNull(contract.deletedAt),
        isNotNull(contract.expiryDate),
        sql`${contract.expiryDate} < current_date`
      )
    )
    .returning({ id: contract.id });

  return {
    quotesExpired: expiredQuotes.length,
    contractsExpired: expiredContracts.length,
    dryRun,
  };
}

export async function POST(req: NextRequest) {
  if (!(await verifyCronRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sweep(false));
}

/** Dry run — reports what would change without changing it. */
export async function GET(req: NextRequest) {
  if (!(await verifyCronRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sweep(true));
}
