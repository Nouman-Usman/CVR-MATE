/**
 * The accounting port.
 *
 * CVR-MATE hands a fulfilled order to the customer's bookkeeping system and
 * mirrors the result back. It does not issue invoices: an invoice is a booked
 * ledger entry that VAT returns are filed from, and Danish bookkeeping rules
 * expect those to live in a registered digital bookkeeping system.
 *
 * The interface is five calls, and it is small on purpose. Everything a
 * bookkeeping system does that CVR-MATE must NOT do is simply absent from it:
 *
 *   • no book()   — booking is legally significant and undone only by a credit
 *                   note, so a human does it in the provider's own UI
 *   • no send()   — the provider owns delivery, including NemHandel/Peppol
 *                   e-invoicing to public-sector EAN numbers
 *   • no credit note, part-payment or dunning — read the status, do not manage
 *                   the debt
 *   • no ledger accounts or postings — that is the accountant's domain
 *
 * Client-safe: no database, no `server-only`, so validation and UI can share
 * these types.
 */

export const ACCOUNTING_PROVIDERS = ["economic", "dinero", "billy"] as const;
export type AccountingProvider = (typeof ACCOUNTING_PROVIDERS)[number];

/** Human labels, for error messages and the connect UI. */
export const ACCOUNTING_PROVIDER_LABELS: Record<AccountingProvider, string> = {
  economic: "e-conomic",
  dinero: "Dinero",
  billy: "Billy",
};

/**
 * Invoice lifecycle as CVR-MATE mirrors it.
 *
 * A subset of what any provider models, chosen so the same states mean the same
 * thing across all three. `draft` is the only state CVR-MATE ever creates.
 */
export const INVOICE_STATUSES = [
  "draft",
  "booked",
  "sent",
  "paid",
  "overdue",
  "credited",
  "cancelled",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** The buyer, as CVR-MATE knows them from the register. */
export interface AccountingCustomerInput {
  name: string;
  /** CVR number, digits only. The primary match key — every Danish system has one. */
  cvr: string | null;
  addressLine?: string | null;
  zipCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  email?: string | null;
  /** Net days. Falls back to the org default when absent. */
  paymentTermsDays?: number | null;
}

export interface AccountingCustomer {
  externalId: string;
  name: string;
  cvr: string | null;
  /** How this customer was arrived at — recorded so a bad match can be found. */
  matchedBy: "cvr" | "name" | "created";
}

/**
 * One invoice line.
 *
 * `unitPriceOre` and the computed totals are in øre, matching the order. Note
 * that `vatRate` is what CVR-MATE believes; providers may derive VAT
 * differently (e-conomic uses the customer's VAT zone and the product's
 * configuration), which is exactly why `createDraftInvoice` reports the
 * provider's own totals back rather than assuming ours were accepted.
 */
export interface AccountingInvoiceLine {
  description: string;
  quantity: number;
  unitPriceOre: number;
  discountPct: number;
  vatRate: number;
  /** Provider product id, when the order line came from a mapped catalog entry. */
  externalProductId?: string | null;
}

export interface DraftInvoiceInput {
  customerExternalId: string;
  currency: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  /** The CVR-MATE order number, so the two systems can be reconciled by eye. */
  reference: string;
  notes?: string | null;
  lines: AccountingInvoiceLine[];
}

/** What a provider reports back about an invoice. Amounts in øre. */
export interface AccountingInvoice {
  externalId: string;
  /** NULL while a draft — the number is allocated by booking. */
  invoiceNumber: string | null;
  status: InvoiceStatus;
  currency: string;
  totalOre: number;
  vatTotalOre: number;
  issueDate: string | null;
  dueDate: string | null;
  pdfUrl: string | null;
}

/** One pre-filled configuration choice, with the alternatives behind it. */
export interface SettingsChoice {
  key: string;
  selectedValue: string | null;
  selectedLabel: string;
  /** False when the pick was a guess and a person should look at it. */
  confident: boolean;
  options: Array<{ value: string; label: string }>;
}

export interface DiscoveredSettings {
  settings: Record<string, unknown>;
  choices: SettingsChoice[];
  /** True when every choice was confident and non-null. */
  complete: boolean;
}

/**
 * What every provider adapter must implement.
 *
 * Adapters are responsible for their own auth headers and for translating
 * provider errors into `AccountingError`. They must not touch the database:
 * mapping and persistence live above them, so a second provider is a new file
 * and nothing else.
 */
export interface AccountingClient {
  readonly provider: AccountingProvider;

  /** Confirm the credential works and name the agreement, for the connect flow. */
  verifyConnection(): Promise<{ agreementName: string | null }>;

  /**
   * Read the agreement's own defaults so connecting does not require a person
   * to look up internal numbers and type them in.
   *
   * Returns the alternatives alongside the picks: some of these decide what VAT
   * a customer is charged, so they must be visible and changeable rather than
   * silently applied.
   */
  discoverSettings(paymentTermsDays: number): Promise<DiscoveredSettings>;

  /** Find a customer by CVR, then by exact name. Null when neither matches. */
  findCustomer(input: AccountingCustomerInput): Promise<AccountingCustomer | null>;

  /** Create a customer from registry data. */
  createCustomer(input: AccountingCustomerInput): Promise<AccountingCustomer>;

  /** Create a DRAFT invoice. Never books it. */
  createDraftInvoice(input: DraftInvoiceInput): Promise<AccountingInvoice>;

  /** Re-read one invoice, following it from draft to booked. */
  getInvoice(externalId: string): Promise<AccountingInvoice | null>;
}

/** Why an accounting call failed, in terms the API layer can map to a status. */
export type AccountingErrorCode =
  | "NOT_CONNECTED"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "INVALID_REQUEST"
  | "NOT_FOUND";

export class AccountingError extends Error {
  public readonly code: AccountingErrorCode;
  /** Provider's own message, kept for the connection's `lastError`. */
  public readonly detail?: string;

  constructor(code: AccountingErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "AccountingError";
    this.code = code;
    this.detail = detail;
  }
}

export function accountingErrorToStatus(err: AccountingError): number {
  switch (err.code) {
    case "NOT_CONNECTED":
      return 409;
    case "AUTH_FAILED":
      return 401;
    case "RATE_LIMITED":
      return 429;
    case "INVALID_REQUEST":
      return 400;
    case "NOT_FOUND":
      return 404;
    default:
      return 502; // The provider failed, not us.
  }
}
