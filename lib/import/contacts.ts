/**
 * Contact CSV import: column mapping, row normalisation and duplicate keys.
 *
 * Pure — no database, no `server-only` — so the browser can auto-map columns
 * and preview a file before anything is uploaded, and so the rules are
 * unit-testable without a fixture database.
 */

/** The fields an imported row can populate. `name` and `cvr` are required. */
export const IMPORT_FIELDS = [
  "cvr",
  "name",
  "title",
  "email",
  "phone",
  "linkedinUrl",
  "notes",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Header spellings seen in real exports, lowercased and stripped of punctuation. */
const HEADER_ALIASES: Record<ImportField, string[]> = {
  cvr: ["cvr", "cvrnr", "cvrnummer", "vat", "vatnumber", "companyid", "virksomhedsnummer"],
  name: ["name", "navn", "fullname", "fuldenavn", "contact", "kontakt", "kontaktperson", "person"],
  title: ["title", "titel", "jobtitle", "stilling", "role", "rolle", "position"],
  email: ["email", "epost", "epostadresse", "mail", "emailaddress", "mailadresse"],
  phone: ["phone", "telefon", "tlf", "mobil", "mobile", "phonenumber", "telefonnummer"],
  linkedinUrl: ["linkedin", "linkedinurl", "linkedinprofile"],
  notes: ["notes", "note", "noter", "comment", "kommentar", "bemaerkning", "bemærkning"],
};

/** Lowercase, strip everything that is not a letter or digit, fold Danish vowels. */
export function normaliseHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Guess a field for each column.
 *
 * A guess, not a decision: the result is shown in an editable mapping step,
 * because silently importing the wrong column into `email` is far worse than
 * asking. Each field is claimed at most once — two columns both matching
 * "phone" would otherwise overwrite each other.
 */
export function autoMapColumns(headers: string[]): Record<number, ImportField | null> {
  const mapping: Record<number, ImportField | null> = {};
  const claimed = new Set<ImportField>();

  headers.forEach((header, i) => {
    const key = normaliseHeader(header);
    const match = IMPORT_FIELDS.find(
      (field) => !claimed.has(field) && HEADER_ALIASES[field].includes(key)
    );
    if (match) claimed.add(match);
    mapping[i] = match ?? null;
  });

  return mapping;
}

export interface MappedRow {
  /**
   * The row's position in the *original file*, 1-based with the header as row 1.
   *
   * Carried through rather than recomputed from the surviving array's index:
   * skipped rows shift every later index, so a derived number would point at
   * the wrong line in the user's spreadsheet — which is the only thing a row
   * number is for.
   */
  sourceRow: number;
  cvr: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  notes?: string;
}

export interface RowIssue {
  /** 1-based, counting the header as row 1 — matches what the user sees in Excel. */
  row: number;
  message: string;
}

/** A Danish CVR is exactly 8 digits. Formatting (spaces, "DK") is tolerated. */
export function normaliseCvr(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return /^\d{8}$/.test(digits) ? digits : null;
}

export interface NormaliseResult {
  rows: MappedRow[];
  issues: RowIssue[];
}

/**
 * Apply a column mapping to raw CSV rows.
 *
 * Invalid rows are collected as issues rather than aborting the import: a
 * 500-row file with three bad CVRs should import 497 contacts and tell you
 * about the three, not fail wholesale and make you edit the spreadsheet blind.
 */
export function normaliseRows(
  records: string[][],
  mapping: Record<number, ImportField | null>
): NormaliseResult {
  const rows: MappedRow[] = [];
  const issues: RowIssue[] = [];

  records.forEach((record, i) => {
    const rowNumber = i + 2; // +1 for zero-index, +1 for the header line
    const values: Partial<Record<ImportField, string>> = {};

    Object.entries(mapping).forEach(([index, field]) => {
      if (!field) return;
      const value = (record[Number(index)] ?? "").trim();
      if (value) values[field] = value;
    });

    // A row that is entirely blank is padding at the end of the file, not an
    // error worth reporting.
    if (Object.keys(values).length === 0) return;

    const cvr = values.cvr ? normaliseCvr(values.cvr) : null;
    if (!cvr) {
      issues.push({
        row: rowNumber,
        message: values.cvr
          ? `"${values.cvr}" is not an 8-digit CVR number`
          : "Missing CVR number",
      });
      return;
    }
    if (!values.name) {
      issues.push({ row: rowNumber, message: "Missing contact name" });
      return;
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      issues.push({ row: rowNumber, message: `"${values.email}" is not a valid email` });
      return;
    }

    rows.push({ ...values, sourceRow: rowNumber, cvr, name: values.name });
  });

  return { rows, issues };
}

/**
 * The key a duplicate is judged on: same company, same email.
 *
 * Deliberately matches the `contact_org_company_email_uq` partial unique index
 * so the preview's verdict and the database's constraint cannot disagree.
 * Rows without an email have no key — they are always treated as new, because
 * two different people at one company legitimately share a name.
 */
export function duplicateKey(row: MappedRow): string | null {
  return row.email ? `${row.cvr}:${row.email.trim().toLowerCase()}` : null;
}

/** Rows appearing more than once *within the file itself*. */
export function findInternalDuplicates(rows: MappedRow[]): Set<number> {
  const seen = new Map<string, number>();
  const duplicates = new Set<number>();
  rows.forEach((row, i) => {
    const key = duplicateKey(row);
    if (!key) return;
    if (seen.has(key)) duplicates.add(i);
    else seen.set(key, i);
  });
  return duplicates;
}
