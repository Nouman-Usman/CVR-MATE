/**
 * Locale-tolerant parsing of hand-typed numbers.
 *
 * Danish users write "1.234,56"; English users write "1,234.56"; plenty of
 * people write "1234.56". `parseFloat` gets the first one catastrophically
 * wrong — it stops at the second separator and returns 1.234, a 1000x
 * under-price on a quote line.
 *
 * Every function here returns `null` for anything it cannot parse
 * unambiguously. Returning 0 would be worse than an error: a zero-priced line
 * looks like a deliberate freebie and passes silently all the way to a customer.
 *
 * Ambiguity rule: money carries at most two decimals, so a separator followed by
 * exactly three digits is a *group* separator ("1.234" = 1234, "1,234" = 1234).
 * One or two trailing digits make it the decimal separator ("1,23" = 1.23).
 * The last separator decides; every earlier one must be grouping.
 */

const STRIPPED = /[\s   ]/g; // incl. non-breaking + narrow spaces
const CURRENCY = /(kr\.?|dkk)/gi;

interface Parts {
  negative: boolean;
  integer: string; // digits only, may be ""
  fraction: string; // digits only, may be ""
}

/**
 * Split a hand-typed number into sign / integer digits / fraction digits, or
 * null if it is not a well-formed number.
 */
function splitParts(raw: string, maxDecimals: number): Parts | null {
  if (typeof raw !== "string") return null;

  let s = raw.replace(STRIPPED, "").replace(CURRENCY, "");
  if (!s) return null;

  let negative = false;
  if (s[0] === "+" || s[0] === "-") {
    negative = s[0] === "-";
    s = s.slice(1);
  }
  if (!s) return null;

  // Only digits and separators may remain.
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastSep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));

  let integer: string;
  let fraction: string;

  if (lastSep === -1) {
    integer = s;
    fraction = "";
  } else {
    const head = s.slice(0, lastSep);
    const tail = s.slice(lastSep + 1);
    if (!/^\d*$/.test(tail)) return null;

    if (tail.length === 3 && maxDecimals <= 2) {
      // Grouping, not a decimal: "1.234" is one thousand two hundred thirty-four.
      integer = head + tail;
      fraction = "";
    } else if (tail.length === 0 || tail.length > maxDecimals) {
      // "12," or "1.2345" as money — not something to guess at.
      return null;
    } else {
      integer = head;
      fraction = tail;
    }
  }

  // Whatever is left in the integer part may only be separated into groups.
  if (integer.includes(".") || integer.includes(",")) {
    const groups = integer.split(/[.,]/);
    // First group 1-3 digits, every later group exactly 3.
    if (groups[0].length < 1 || groups[0].length > 3) return null;
    if (groups.slice(1).some((g) => g.length !== 3)) return null;
    integer = groups.join("");
  }

  if (!/^\d*$/.test(integer)) return null;
  if (integer === "" && fraction === "") return null;

  return { negative, integer: integer || "0", fraction };
}

/**
 * Parse kroner as typed by a human into **integer øre**.
 *
 * Built from the digit strings rather than `value * 100` so it stays exact —
 * `12.34 * 100` is 1233.9999999999998 in IEEE754.
 *
 * @returns integer øre, or null if the input is not an unambiguous amount.
 */
export function parseKronerToOre(raw: string): number | null {
  const parts = splitParts(raw, 2);
  if (!parts) return null;

  const ore = Number(parts.integer + parts.fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(ore)) return null;

  return parts.negative ? -ore : ore;
}

/**
 * Parse a quantity as typed by a human (supports "2,5" and "2.5").
 *
 * @returns the number, or null if unparseable.
 */
export function parseQuantity(raw: string): number | null {
  const parts = splitParts(raw, 2);
  if (!parts) return null;

  const value = Number(
    `${parts.integer}${parts.fraction ? `.${parts.fraction}` : ""}`
  );
  if (!Number.isFinite(value)) return null;

  return parts.negative ? -value : value;
}

/**
 * Parse a percentage (discount, VAT). Bounds are enforced by the caller's
 * schema; this only handles the number format.
 */
export function parsePercent(raw: string): number | null {
  return parseQuantity(raw.replace(/%/g, ""));
}

/** Render integer øre back into an editable kroner string ("123456" → "1234,56"). */
export function oreToInputString(ore: number, locale: "da" | "en" = "da"): string {
  const negative = ore < 0;
  const abs = Math.abs(Math.round(ore));
  const kroner = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  const sep = locale === "da" ? "," : ".";
  return `${negative ? "-" : ""}${kroner}${sep}${rest}`;
}
