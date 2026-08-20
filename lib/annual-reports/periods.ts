import type { CvrAccountingDocument, CvrAccountingSummary } from "@/lib/cvr-api";

/**
 * Annual-report period extraction.
 *
 * PURE DOMAIN MODULE. No database, no notifications, no cron, no permissions,
 * no clock. Answers exactly one question:
 *
 *   "What annual-report periods are represented by this payload, and which two
 *    are financially current?"
 *
 * Detection against stored state happens in the caller, against the unique
 * index on `annual_report_event` — never here.
 *
 * ── Annual-report invariants ────────────────────────────────────────────────
 *
 *  1. Only AARSRAPPORT documents participate in annual-report detection.
 *  2. (cvr, period_end, source) is the canonical report identity.
 *  3. period_end determines financial ordering; publicdate never does.
 *  4. Detection is set membership, never a "latest period" watermark.
 *  5. Every AARSRAPPORT period must be offered to the event insert.
 *  6. Multiple documents with the same period_end represent ONE financial period.
 *  7. For a period with multiple documents, the highest publicdate is the
 *     current revision.
 *  8. Refilings update the existing period but never create a new notification
 *     event in v1.
 *  9. [0] and [1] mean the latest two distinct period_end VALUES, never the
 *     latest two documents.
 * 10. First sight seeds all observed periods but emits no notifications.
 * 11. Notification audience is org owners ∪ org admins ∪ follower, deduplicated.
 * 12. publicdate remains available for late-filing intelligence but never
 *     affects identity, ordering, or detection.
 *
 * Why, concretely: Novo Nordisk's FY2000 annual report was filed 2004-07-19 —
 * after FY2001, FY2002 and FY2003. Ordering by filing date calls a 2000 report
 * "the latest"; a watermark on the newest period never notices it arriving.
 */

/** The document type that is a company's annual accounts. Nothing else. */
export const ANNUAL_REPORT_TYPE = "AARSRAPPORT";

/**
 * Types deliberately excluded. Kept as a named list so the exclusion is a
 * decision in the code rather than an accident of the filter:
 * interim, half-year, and consolidated group accounts.
 */
export const NON_ANNUAL_TYPES = [
  "DELAARSRAPPORT",
  "HALVAARSRAPPORT",
  "KONCERNREGNSKAB",
] as const;

/** One financial period, after collapsing every document filed for it. */
export interface AnnualReportPeriod {
  /** `YYYY-MM-DD`. Canonical identity AND chronology. */
  periodEnd: string;
  periodStart: string | null;
  /** Filing date of the CURRENT revision. Metadata only. */
  publicdate: string | null;
  documentUrl: string | null;
  /** Null when the filing carries no figures — 139 of 306 observed reports. */
  summary: CvrAccountingSummary | null;
  /**
   * How many documents were filed for this period. `1` is the normal case;
   * `> 1` means a refiling, which updates the period but must not re-notify.
   */
  documentCount: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Every distinct annual-report period in a payload, newest first.
 *
 * This is the DETECTION input: the caller offers all of these to the event
 * insert. It is deliberately not named "latest" anything — an accessor that
 * returns only the newest reports must never become the detection source, or
 * a late filing like Novo's FY2000 stops being seen at all.
 *
 * Sorted by `periodEnd` descending. `YYYY-MM-DD` sorts lexicographically in
 * chronological order, so this needs no date parsing and therefore has no
 * timezone behaviour to get wrong.
 */
export function extractAnnualReportPeriods(
  documents: CvrAccountingDocument[] | null | undefined
): AnnualReportPeriod[] {
  const byPeriod = new Map<string, AnnualReportPeriod>();

  for (const doc of documents ?? []) {
    if (doc?.type !== ANNUAL_REPORT_TYPE) continue;

    const periodEnd = doc.end?.trim();
    // A document without a valid period has no identity and cannot become a
    // period. It is dropped rather than guessed at from publicdate.
    if (!periodEnd || !ISO_DATE.test(periodEnd)) continue;

    const candidate: AnnualReportPeriod = {
      periodEnd,
      periodStart: normaliseDate(doc.start),
      publicdate: normaliseDate(doc.publicdate),
      documentUrl: doc.url?.trim() || null,
      summary: normaliseSummary(doc.summary),
      documentCount: 1,
    };

    const existing = byPeriod.get(periodEnd);
    if (!existing) {
      byPeriod.set(periodEnd, candidate);
      continue;
    }

    // Same period seen twice: one financial period, two documents. Keep the
    // current revision's fields, but carry the count forward so a refiling is
    // visible to the caller.
    const winner = preferRevision(existing, candidate);
    winner.documentCount = existing.documentCount + 1;
    byPeriod.set(periodEnd, winner);
  }

  return [...byPeriod.values()].sort((a, b) => (a.periodEnd < b.periodEnd ? 1 : -1));
}

/**
 * Which of two documents for the SAME period is the current revision.
 *
 * Highest `publicdate` wins. When neither has one — or they tie — the higher
 * `documentUrl` wins, purely so the result cannot depend on the order the API
 * happened to return them in. Input order must never change the output.
 */
function preferRevision(a: AnnualReportPeriod, b: AnnualReportPeriod): AnnualReportPeriod {
  if (a.publicdate !== b.publicdate) {
    if (!a.publicdate) return b;
    if (!b.publicdate) return a;
    return b.publicdate > a.publicdate ? b : a;
  }
  return (b.documentUrl ?? "") > (a.documentUrl ?? "") ? b : a;
}

/**
 * The two financially current periods, for enrichment only — metrics, YoY and
 * notification copy.
 *
 * `latest` is the newest period, `previous` the one before it. Both are
 * distinct `periodEnd` values by construction, so a refiled period can never
 * appear as its own predecessor and make a year-over-year comparison read 0%.
 *
 * NEVER use this for detection. See invariants 4, 5 and 9.
 */
export function financiallyCurrent(periods: AnnualReportPeriod[]): {
  latest: AnnualReportPeriod | null;
  previous: AnnualReportPeriod | null;
} {
  return { latest: periods[0] ?? null, previous: periods[1] ?? null };
}

/** Just the period keys — what the caller offers to the event insert. */
export function periodKeys(periods: AnnualReportPeriod[]): string[] {
  return periods.map((p) => p.periodEnd);
}

/**
 * Periods present in the payload that are not already known.
 *
 * A pure convenience for callers and tests. It is NOT the authority: the
 * database's `ON CONFLICT ... DO NOTHING RETURNING` decides what is new, so
 * that concurrent runs and retries cannot both conclude "this is new".
 */
export function unseenPeriods(
  periods: AnnualReportPeriod[],
  known: Iterable<string>
): AnnualReportPeriod[] {
  const seen = new Set(known);
  return periods.filter((p) => !seen.has(p.periodEnd));
}

/** How late a filing was, in days after the period closed. Null if unknowable. */
export function filingDelayDays(period: AnnualReportPeriod): number | null {
  if (!period.publicdate) return null;
  const end = Date.parse(`${period.periodEnd}T00:00:00Z`);
  const filed = Date.parse(`${period.publicdate}T00:00:00Z`);
  if (Number.isNaN(end) || Number.isNaN(filed)) return null;
  return Math.round((filed - end) / 86_400_000);
}

function normaliseDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && ISO_DATE.test(trimmed) ? trimmed : null;
}

function normaliseSummary(
  summary: CvrAccountingSummary | [] | null | undefined
): CvrAccountingSummary | null {
  if (!summary || Array.isArray(summary)) return null;
  return summary;
}
