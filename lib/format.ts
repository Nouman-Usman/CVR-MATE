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

/** Format a DKK amount. Returns "–" for null/invalid. */
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
