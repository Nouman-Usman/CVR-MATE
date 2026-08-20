import { formatDKK } from "@/lib/format";

import { filingDelayDays, type AnnualReportPeriod } from "./periods";

/**
 * Copy for an annual-report alert.
 *
 * PURE — no clock, no database, locale passed in.
 *
 * Deliberately tolerant of missing figures. `summary` is absent on 139 of 306
 * observed annual reports, and — counter-intuitively — on the largest filers:
 * Novo Nordisk and Lindab file annual reports with no summary at all, while a
 * two-person ApS has one. Figures are ENRICHMENT; their absence must never
 * suppress an otherwise valid notification.
 *
 * Revenue is never led with: only 24 of 306 reports disclose it, because
 * Danish accounting class B permits omitting it. Profit, equity and gross
 * profit are the figures that actually exist.
 */

export interface RenderedReport {
  title: string;
  /** One line, safe to use as a notification body or a digest row. */
  message: string;
  /** Present only when the filing carried figures. */
  figures: { label: string; value: string }[];
  /** "Filed 86 days after period end" — always available when publicdate is. */
  filingNote: string | null;
  documentUrl: string | null;
}

export interface RenderInput {
  companyName: string;
  period: AnnualReportPeriod;
  /** The period before it, for year-over-year. Optional by nature. */
  previous?: AnnualReportPeriod | null;
  locale: string;
}

export function renderAnnualReport({
  companyName,
  period,
  previous,
  locale,
}: RenderInput): RenderedReport {
  const da = locale === "da";
  const year = fiscalYearLabel(period.periodEnd);

  const title = da
    ? `${companyName} har indleveret årsrapport ${year}`
    : `${companyName} filed its ${year} annual report`;

  const figures = buildFigures(period, previous, locale);

  const message =
    figures.length > 0
      ? figures.map((f) => `${f.label}: ${f.value}`).join(" · ")
      : da
        ? "Regnskabstal er ikke tilgængelige i indberetningen."
        : "Financial figures are not available in the filing data.";

  return {
    title,
    message,
    figures,
    filingNote: buildFilingNote(period, locale),
    documentUrl: period.documentUrl,
  };
}

/**
 * The three figures Danish filings actually carry, each with year-over-year
 * when the previous period exists AND reported the same figure.
 */
function buildFigures(
  period: AnnualReportPeriod,
  previous: AnnualReportPeriod | null | undefined,
  locale: string
): { label: string; value: string }[] {
  const s = period.summary;
  if (!s) return [];

  const da = locale === "da";
  const prev = previous?.summary ?? null;

  const rows: { label: string; value: number | null; before: number | null }[] = [
    {
      label: da ? "Årets resultat" : "Profit/loss",
      value: s.profitloss,
      before: prev?.profitloss ?? null,
    },
    {
      label: da ? "Egenkapital" : "Equity",
      value: s.equity,
      before: prev?.equity ?? null,
    },
    {
      label: da ? "Bruttofortjeneste" : "Gross profit",
      value: s.grossprofitloss,
      before: prev?.grossprofitloss ?? null,
    },
  ];

  return rows
    .filter((r) => r.value != null)
    .map((r) => ({
      label: r.label,
      value: `${formatDKK(r.value, locale)}${formatChange(r.value!, r.before)}`,
    }));
}

/**
 * Year-over-year, omitted rather than faked.
 *
 * Skipped when the previous period did not report the figure, and when the
 * previous value is zero — a percentage against zero is not a growth rate.
 * A sign flip (a loss becoming a profit) is described in words, because
 * "+340%" on a swing from negative to positive is arithmetically true and
 * completely misleading.
 */
function formatChange(current: number, before: number | null): string {
  if (before == null || before === 0) return "";
  if (current === before) return "";

  if (before < 0 && current > 0) return " ↑";
  if (before > 0 && current < 0) return " ↓";

  const pct = Math.round(((current - before) / Math.abs(before)) * 100);
  if (pct === 0) return "";
  return ` (${pct > 0 ? "+" : ""}${pct}%)`;
}

/** "Filed 86 days after period end" — metadata, never used for ordering. */
function buildFilingNote(period: AnnualReportPeriod, locale: string): string | null {
  const days = filingDelayDays(period);
  if (days == null) return null;
  const da = locale === "da";

  if (days < 0) {
    return da ? "Indleveret før periodens udløb" : "Filed before the period closed";
  }
  if (days > 550) {
    const years = Math.floor(days / 365);
    return da
      ? `Indleveret ca. ${years} år efter periodens udløb`
      : `Filed about ${years} years after the period closed`;
  }
  return da
    ? `Indleveret ${days} dage efter periodens udløb`
    : `Filed ${days} days after the period closed`;
}

/**
 * "2024/25" for an offset fiscal year, "2025" for a calendar one — how the
 * period is actually referred to, rather than a raw date.
 */
export function fiscalYearLabel(periodEnd: string): string {
  const [year, month, day] = periodEnd.split("-");
  // A calendar fiscal year is named by its single year; an offset one spans
  // two, and is written the way the register and accountants write it.
  if (month === "12" && day === "31") return year;
  return `${Number(year) - 1}/${year.slice(2)}`;
}
