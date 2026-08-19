/**
 * Shared locale-aware formatters (Danish / English). Client-safe — no
 * `server-only` — so both server routes and client components can import.
 *
 * Extracted from the private helpers in app/company/[vat]/page.tsx so the CRM
 * UI (contact lists, pipeline cards, deal amounts) formats identically.
 *
 * Note: Drizzle `numeric()` columns read back as `string` to preserve
 * precision — these helpers accept `string | number` and coerce safely.
 */

function resolveLocale(locale: string): string {
  return locale === "da" ? "da-DK" : "en-US";
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

/**
 * Format a WHOLE-KRONER amount (no decimals). Returns "–" for null/invalid.
 *
 * NOT for CRM money. Every CRM figure — quotes, orders, contracts, deals — is
 * stored in integer øre and must use `formatOre`; passing øre here renders a
 * number 100x too large. This exists for externally-sourced whole-kroner data
 * such as CVR registry accounting figures.
 */
export function formatDKK(
  value: number | string | null | undefined,
  locale: string
): string {
  const n = toNumber(value);
  if (n == null) return "–";
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Format an amount given in ØRE (integer minor units) as DKK with 2 decimals —
 * the quotation/order display counterpart to øre storage. Use this (not
 * `formatDKK`, which drops fractions) wherever quote/order money is shown.
 */
export function formatOre(
  ore: number | string | null | undefined,
  locale: string
): string {
  const n = toNumber(ore);
  if (n == null) return "–";
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: "currency",
    currency: "DKK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n / 100);
}

/** Format a plain number with locale grouping. Returns "–" for null/invalid. */
export function formatNumber(
  value: number | string | null | undefined,
  locale: string
): string {
  const n = toNumber(value);
  if (n == null) return "–";
  return n.toLocaleString(resolveLocale(locale));
}

/** Format a date (Date or ISO string). Returns "–" for null/invalid. */
export function formatDate(
  value: string | Date | null | undefined,
  locale: string
): string {
  if (value == null) return "–";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString(resolveLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Whole days elapsed since `value` (e.g. days-in-stage). Null → null. */
export function daysSince(value: string | Date | null | undefined): number | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Format an XSD gMonthDay ("--10-01") — the shape CVR uses for a recurring
 * fiscal-year boundary. Returns null when the input is not a gMonthDay, so a
 * full date is never silently mis-rendered as a month-day.
 *
 * Printing the raw value inverts its meaning for a Danish reader: "10-01" is
 * ISO month-day but parses as 10 January. Intl puts the fields in the reader's
 * order instead — da-DK "01.10", en-US "10/01".
 */
export function formatMonthDay(
  value: string | null | undefined,
  locale: string
): string | null {
  const m = value?.match(/^--(\d{2})-(\d{2})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // 2024 is a leap year, so "--02-29" survives the round-trip.
  const d = new Date(Date.UTC(2024, month - 1, day));
  return (
    d
      .toLocaleDateString(resolveLocale(locale), {
        day: "2-digit",
        month: "2-digit",
        timeZone: "UTC",
      })
      // Some ICU builds append a separator when the year is omitted.
      .replace(/[.\/-]$/, "")
  );
}

/**
 * Numeric date for period ranges — "08.04.2021" rather than `formatDate`'s
 * "8. apr. 2021". Two of these sit side by side in a range, where the long
 * form is unreadable. Returns null (not "–") so callers can hide the row.
 */
export function formatDateShort(
  value: string | Date | null | undefined,
  locale: string
): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(resolveLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
