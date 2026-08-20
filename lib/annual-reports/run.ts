import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { annualReportEvent, changeFeedCursor, company, companyMetrics, followedCompany } from "@/db/schema";
import { getCompanyByVatFresh, type CvrCompany } from "@/lib/cvr-api";

import {
  extractAnnualReportPeriods,
  financiallyCurrent,
  type AnnualReportPeriod,
} from "./periods";

/**
 * Annual-report polling run.
 *
 * Establishes the event/state pipeline; it deliberately sends nothing. What is
 * *notifiable* is returned to the caller (S5 delivers it), because a period
 * seeded on a follow's first sight must never be announced.
 *
 * Two different guarantees, both wanted:
 *
 *   The LOCK prevents duplicate WORK.
 *   ON CONFLICT prevents duplicate TRUTH.
 *
 * The lock stops two workers burning the same CVR lookups. It is not what
 * makes the result correct — `annual_report_event`'s unique index is, which is
 * why a lost lock, a retry or a crash mid-batch cannot produce a second
 * "new period" for the same report.
 *
 * Consumes `extractAnnualReportPeriods` / `financiallyCurrent` and never
 * touches `documents[0]` directly: the raw array mixes half-year and group
 * filings, so its first element is not the latest annual report.
 */

const FEED_TYPE = "annual-reports";
const BATCH_SIZE = 5;

export interface CompanyOutcome {
  cvr: string;
  companyName: string | null;
  /** Periods this run saw for the first time, in period_end DESC order. */
  newPeriods: AnnualReportPeriod[];
  /** Known periods whose filed document changed — refilings. Never notified. */
  updatedPeriods: AnnualReportPeriod[];
  /** True when at least one follow was seeing this company for the first time. */
  hadFirstSight: boolean;
  metricsWritten: boolean;
  error?: string;
}

export interface AnnualReportRunResult {
  skipped?: string;
  companiesPolled: number;
  newEvents: number;
  refilings: number;
  metricsWritten: number;
  errors: { cvr: string; error: string }[];
  /**
   * What S5 may announce: new periods for follows that were NOT first sight.
   * Empty on a first run by construction.
   */
  notifiable: { cvr: string; period: AnnualReportPeriod; followIds: string[] }[];
}

export async function runAnnualReportPoll(
  options: { dryRun?: boolean; fetchCompany?: (vat: number) => Promise<CvrCompany> } = {}
): Promise<AnnualReportRunResult> {
  const fetchCompany = options.fetchCompany ?? getCompanyByVatFresh;
  const empty: AnnualReportRunResult = {
    companiesPolled: 0,
    newEvents: 0,
    refilings: 0,
    metricsWritten: 0,
    errors: [],
    notifiable: [],
  };

  const follows = await db
    .select({
      id: followedCompany.id,
      cvr: followedCompany.cvr,
      companyName: followedCompany.companyName,
      lastCheckedAt: followedCompany.lastCheckedAt,
    })
    .from(followedCompany)
    .where(eq(followedCompany.isActive, true));

  if (follows.length === 0) return { ...empty, skipped: "no active follows" };

  // One lookup per distinct CVR, however many users follow it.
  const byCvr = new Map<string, typeof follows>();
  for (const f of follows) {
    const list = byCvr.get(f.cvr) ?? [];
    list.push(f);
    byCvr.set(f.cvr, list);
  }
  const cvrs = [...byCvr.keys()];

  if (options.dryRun) {
    return { ...empty, skipped: "dry run", companiesPolled: cvrs.length };
  }

  const lock = await acquireLock();
  if (!lock.acquired || !lock.cursorId) {
    return { ...empty, skipped: "another worker is processing" };
  }

  const outcomes: CompanyOutcome[] = [];

  try {
    for (let i = 0; i < cvrs.length; i += BATCH_SIZE) {
      const batch = cvrs.slice(i, i + BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map((cvr) => pollCompany(cvr, byCvr.get(cvr)!, fetchCompany))
      );

      for (let j = 0; j < settled.length; j++) {
        const result = settled[j];
        if (result.status === "fulfilled") {
          outcomes.push(result.value);
        } else {
          // One dead company must never abort the rest of the run.
          outcomes.push({
            cvr: batch[j],
            companyName: null,
            newPeriods: [],
            updatedPeriods: [],
            hadFirstSight: false,
            metricsWritten: false,
            error: messageOf(result.reason),
          });
        }
      }
    }
  } finally {
    await releaseLock(lock.cursorId);
  }

  const notifiable: AnnualReportRunResult["notifiable"] = [];
  for (const outcome of outcomes) {
    const followsForCvr = byCvr.get(outcome.cvr) ?? [];
    // A follow seeing this company for the first time is SEEDED: it receives
    // nothing, however many periods were just recorded. Otherwise switching the
    // feature on announces reports filed months ago.
    const notifiableFollows = followsForCvr
      .filter((f) => f.lastCheckedAt !== null)
      .map((f) => f.id);
    if (notifiableFollows.length === 0) continue;

    for (const period of outcome.newPeriods) {
      notifiable.push({ cvr: outcome.cvr, period, followIds: notifiableFollows });
    }
  }

  return {
    companiesPolled: outcomes.length,
    newEvents: outcomes.reduce((n, o) => n + o.newPeriods.length, 0),
    refilings: outcomes.reduce((n, o) => n + o.updatedPeriods.length, 0),
    metricsWritten: outcomes.filter((o) => o.metricsWritten).length,
    errors: outcomes.filter((o) => o.error).map((o) => ({ cvr: o.cvr, error: o.error! })),
    notifiable,
  };
}

// ─── Per company ────────────────────────────────────────────────────────────

async function pollCompany(
  cvr: string,
  follows: { id: string; lastCheckedAt: Date | null; companyName: string | null }[],
  fetchCompany: (vat: number) => Promise<CvrCompany>
): Promise<CompanyOutcome> {
  const hadFirstSight = follows.some((f) => f.lastCheckedAt === null);
  const fresh = await fetchCompany(Number(cvr));
  const companyName = fresh.life?.name ?? follows[0]?.companyName ?? null;

  const periods = extractAnnualReportPeriods(fresh.accounting?.documents);

  // Detection. EVERY period is offered — a late filing of an old period is new
  // to us even though it is not the newest period. The database decides what
  // is new; nothing here compares against a watermark.
  const newPeriods =
    periods.length > 0 ? await insertPeriods(cvr, companyName, periods) : [];

  const newKeys = new Set(newPeriods.map((p) => p.periodEnd));
  const updatedPeriods = await refreshKnownPeriods(
    cvr,
    periods.filter((p) => !newKeys.has(p.periodEnd))
  );

  // Enrichment, strictly after detection and never a precondition for it.
  const { latest } = financiallyCurrent(periods);
  const metricsWritten = latest ? await upsertMetrics(cvr, latest) : false;

  // Always advances — a company that has never filed still counts as checked,
  // and this is what retires its first-sight status.
  await db
    .update(followedCompany)
    .set({ lastCheckedAt: new Date() })
    .where(
      inArray(
        followedCompany.id,
        follows.map((f) => f.id)
      )
    );

  return { cvr, companyName, newPeriods, updatedPeriods, hadFirstSight, metricsWritten };
}

/**
 * Offer every period to the unique index; the returned rows ARE the new ones.
 *
 * Idempotent by construction: a retry, a crash mid-batch or a second worker
 * that slipped past the lock all converge on the same answer, because the
 * database — not this process — decides what already existed.
 */
async function insertPeriods(
  cvr: string,
  companyName: string | null,
  periods: AnnualReportPeriod[]
): Promise<AnnualReportPeriod[]> {
  const inserted = await db
    .insert(annualReportEvent)
    .values(
      periods.map((p) => ({
        cvr,
        companyName,
        periodEnd: p.periodEnd,
        periodStart: p.periodStart,
        source: "cvr_api",
        publicdate: p.publicdate,
        documentUrl: p.documentUrl,
        // Recorded when present; NEVER a precondition for the event. Novo and
        // Lindab file annual reports with no summary at all.
        summaryJson: p.summary ?? null,
        revisionCount: Math.max(0, p.documentCount - 1),
      }))
    )
    .onConflictDoNothing({
      target: [annualReportEvent.cvr, annualReportEvent.periodEnd, annualReportEvent.source],
    })
    .returning({ periodEnd: annualReportEvent.periodEnd });

  const newKeys = new Set(inserted.map((r) => r.periodEnd));
  return periods.filter((p) => newKeys.has(p.periodEnd));
}

/**
 * A known period whose current document changed — a refiling.
 *
 * Recorded, never notified (invariant 8). The event's assertion is unchanged
 * ("this period became known"); only its revision metadata moves.
 */
async function refreshKnownPeriods(
  cvr: string,
  known: AnnualReportPeriod[]
): Promise<AnnualReportPeriod[]> {
  const changed: AnnualReportPeriod[] = [];

  for (const period of known) {
    const updated = await db
      .update(annualReportEvent)
      .set({
        publicdate: period.publicdate,
        documentUrl: period.documentUrl,
        summaryJson: period.summary ?? null,
        revisionCount: Math.max(0, period.documentCount - 1),
      })
      .where(
        and(
          eq(annualReportEvent.cvr, cvr),
          eq(annualReportEvent.periodEnd, period.periodEnd),
          eq(annualReportEvent.source, "cvr_api"),
          // Only when something actually moved, so an unchanged poll writes
          // nothing and `updatedAt` stays meaningful.
          sql`(
            ${annualReportEvent.publicdate} is distinct from ${period.publicdate}::date
            or ${annualReportEvent.documentUrl} is distinct from ${period.documentUrl}
          )`
        )
      )
      .returning({ periodEnd: annualReportEvent.periodEnd });

    if (updated.length > 0) changed.push(period);
  }

  return changed;
}

/**
 * `company_metrics` is STATE, so a refiling must UPDATE the period rather than
 * add a row. Skipped entirely when the filing carries no figures — 139 of 306
 * observed annual reports have none, and an event does not depend on them.
 */
async function upsertMetrics(cvr: string, period: AnnualReportPeriod): Promise<boolean> {
  if (!period.summary) return false;

  const row = await db.query.company.findFirst({
    where: eq(company.vat, cvr),
    columns: { id: true },
  });
  if (!row) return false;

  const s = period.summary;
  await db
    .insert(companyMetrics)
    .values({
      companyId: row.id,
      periodEnd: period.periodEnd,
      source: "cvr_api",
      employees: s.averagenumberofemployees,
      revenue: s.revenue != null ? String(s.revenue) : null,
      profit: s.profitloss != null ? String(s.profitloss) : null,
      equity: s.equity != null ? String(s.equity) : null,
    })
    .onConflictDoUpdate({
      target: [companyMetrics.companyId, companyMetrics.periodEnd, companyMetrics.source],
      set: {
        employees: s.averagenumberofemployees,
        revenue: s.revenue != null ? String(s.revenue) : null,
        profit: s.profitloss != null ? String(s.profitloss) : null,
        equity: s.equity != null ? String(s.equity) : null,
      },
    });

  return true;
}

// ─── Lock ───────────────────────────────────────────────────────────────────

/**
 * Claim the processing lock in ONE atomic statement.
 *
 * The read-then-insert shape used elsewhere in this codebase races: two workers
 * both find no cursor row, both INSERT, and the second dies on
 * `change_feed_cursor_type_idx`. Doing it as a conditional upsert means
 * Postgres arbitrates — zero rows returned is simply "someone else holds it",
 * which is a normal outcome rather than an error.
 *
 * The stale-lock window is expressed in SQL so it is evaluated against the
 * database clock, not this process's.
 */
async function acquireLock(): Promise<{ acquired: boolean; cursorId: string | null }> {
  const staleCutoff = sql`now() - interval '30 minutes'`;

  const claimed = await db
    .insert(changeFeedCursor)
    .values({
      feedType: FEED_TYPE,
      // This feed carries no cursor — detection is set membership, not a
      // position. The row exists purely to hold the lock.
      lastChangeId: "0",
      isProcessing: true,
      processingStartedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: changeFeedCursor.feedType,
      set: { isProcessing: true, processingStartedAt: new Date() },
      setWhere: sql`${changeFeedCursor.isProcessing} = false
        or ${changeFeedCursor.processingStartedAt} is null
        or ${changeFeedCursor.processingStartedAt} < ${staleCutoff}`,
    })
    .returning({ id: changeFeedCursor.id });

  return claimed.length > 0
    ? { acquired: true, cursorId: claimed[0].id }
    : { acquired: false, cursorId: null };
}

async function releaseLock(cursorId: string): Promise<void> {
  await db
    .update(changeFeedCursor)
    .set({ isProcessing: false, processingStartedAt: null, processedAt: new Date() })
    .where(eq(changeFeedCursor.id, cursorId));
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
