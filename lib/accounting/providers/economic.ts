/**
 * e-conomic (Visma) adapter.
 *
 * ── Auth ────────────────────────────────────────────────────────────────────
 * Not OAuth. Two headers on every request:
 *   X-AppSecretToken       — the app's own secret, an app-wide env var
 *   X-AgreementGrantToken  — the customer's grant, stored per connection
 * The app token is deliberately NOT stored per organization: it identifies
 * CVR-MATE, not the customer, and duplicating it per row would mean rotating it
 * in N places.
 *
 * ── Amounts ─────────────────────────────────────────────────────────────────
 * e-conomic speaks decimal DKK; CVR-MATE speaks integer øre. Every crossing goes
 * through `oreToAmount` / `amountToOre`, never an inline `/100`.
 *
 * ── VAT ─────────────────────────────────────────────────────────────────────
 * e-conomic derives VAT from the customer's VAT zone and the product's account
 * configuration. It does NOT take a per-line rate from us. Our `vatRate` is
 * therefore advisory at this boundary, which is exactly why the caller
 * reconciles the created draft's totals against the order instead of assuming
 * they match.
 *
 * ── Unverified against a live agreement ─────────────────────────────────────
 * The request shapes below follow e-conomic's documented REST API, but no
 * agreement grant exists yet, so nothing here has been exercised against the
 * real service. The HTTP layer is injectable precisely so the mapping can be
 * tested without one — see `__tests__/unit/accounting/economic.test.ts`. Treat
 * field names as the first thing to check when the app registration clears.
 */

import {
  chooseEconomicSettings,
  type EconomicCandidates,
  type EconomicCustomerGroup,
  type EconomicLayout,
  type EconomicPaymentTerm,
  type EconomicProduct,
  type EconomicVatZone,
} from "./economic-discovery";
import {
  AccountingError,
  type AccountingClient,
  type AccountingCustomer,
  type AccountingCustomerInput,
  type AccountingInvoice,
  type DiscoveredSettings,
  type DraftInvoiceInput,
  type InvoiceStatus,
} from "../types";

const DEFAULT_BASE_URL = "https://restapi.e-conomic.com";

/**
 * Overridable so the adapter can be pointed at e-conomic's sandbox, or at a
 * local stand-in while no agreement grant exists. Falls back to production, so
 * an unset variable behaves exactly as before.
 */
function resolveBaseUrl(explicit?: string): string {
  return explicit ?? process.env.ECONOMIC_API_BASE_URL ?? DEFAULT_BASE_URL;
}

/** Agreement-local numbers, discovered at connect time. */
export interface EconomicSettings {
  customerGroupNumber: number;
  vatZoneNumber: number;
  paymentTermsNumber: number;
  layoutNumber: number;
  /** Product used for ad-hoc lines; e-conomic invoice lines require a product. */
  fallbackProductNumber: string | null;
}

/** Injectable so the adapter is testable without an agreement grant. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface EconomicConfig {
  appSecretToken: string;
  agreementGrantToken: string;
  settings?: Partial<EconomicSettings>;
  fetchImpl?: FetchLike;
  /** Defaults to ECONOMIC_API_BASE_URL, then to the production endpoint. */
  baseUrl?: string;
}

/** øre → decimal DKK. Exact: integers below 2^53 divide by 100 without drift. */
export function oreToAmount(ore: number): number {
  return Math.round(ore) / 100;
}

/** decimal DKK → øre, rounding once at the boundary. */
export function amountToOre(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  // *100 on a float can land on 2499.9999997; round after scaling, not before.
  return Math.round(amount * 100);
}

/** Digits only — e-conomic rejects a CVR with spaces or a DK prefix. */
export function normalizeCvr(cvr: string | null | undefined): string | null {
  if (!cvr) return null;
  const digits = cvr.replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

/**
 * e-conomic's own filter syntax: `field$eq:value`, with `$` and `:` as
 * operators. A value containing either would change the meaning of the query,
 * so callers must only pass values that have been normalised first.
 */
function eqFilter(field: string, value: string): string {
  return `${field}$eq:${encodeURIComponent(value)}`;
}

interface EconomicCustomerDto {
  customerNumber: number;
  name: string;
  corporateIdentificationNumber?: string | null;
}

interface EconomicInvoiceDto {
  draftInvoiceNumber?: number;
  bookedInvoiceNumber?: number;
  currency?: string;
  netAmount?: number;
  vatAmount?: number;
  grossAmount?: number;
  date?: string;
  dueDate?: string;
  remainder?: number;
  pdf?: { download?: string };
}

export class EconomicClient implements AccountingClient {
  readonly provider = "economic" as const;

  private readonly appSecretToken: string;
  private readonly agreementGrantToken: string;
  private readonly settings: Partial<EconomicSettings>;
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;

  constructor(config: EconomicConfig) {
    this.appSecretToken = config.appSecretToken;
    this.agreementGrantToken = config.agreementGrantToken;
    this.settings = config.settings ?? {};
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.baseUrl = resolveBaseUrl(config.baseUrl);
  }

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          "X-AppSecretToken": this.appSecretToken,
          "X-AgreementGrantToken": this.agreementGrantToken,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
    } catch (err) {
      // A network failure is the provider being unreachable, not a bad request.
      throw new AccountingError(
        "PROVIDER_ERROR",
        "Could not reach e-conomic.",
        err instanceof Error ? err.message : String(err)
      );
    }

    if (res.status === 404) throw new AccountingError("NOT_FOUND", "Not found in e-conomic.");
    if (res.status === 401 || res.status === 403) {
      throw new AccountingError(
        "AUTH_FAILED",
        "e-conomic rejected the connection. Reconnect the agreement."
      );
    }
    if (res.status === 429) {
      throw new AccountingError("RATE_LIMITED", "e-conomic is rate limiting requests.");
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AccountingError(
        res.status >= 500 ? "PROVIDER_ERROR" : "INVALID_REQUEST",
        `e-conomic returned ${res.status}.`,
        detail.slice(0, 500)
      );
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private required<K extends keyof EconomicSettings>(key: K): EconomicSettings[K] {
    const value = this.settings[key];
    if (value === undefined || value === null) {
      // Failing loudly here beats sending a half-formed invoice: e-conomic would
      // either reject it or, worse, accept it with a default we did not choose.
      throw new AccountingError(
        "NOT_CONNECTED",
        `The e-conomic connection is missing "${String(key)}". Reconnect to refresh its settings.`
      );
    }
    return value as EconomicSettings[K];
  }

  async verifyConnection(): Promise<{ agreementName: string | null }> {
    const self = await this.call<{ company?: { name?: string }; agreementNumber?: number }>("/self");
    return { agreementName: self.company?.name ?? null };
  }

  /**
   * Read the agreement's customer groups, VAT zones, payment terms, layouts and
   * products, and pre-select a sensible default for each.
   *
   * Fetched in parallel — they are independent reads, and a connect flow that
   * makes someone wait for five sequential round-trips feels broken.
   *
   * A single collection failing is not fatal: the picker reports an incomplete
   * result and the UI asks the person to choose, which is better than refusing
   * to connect because one endpoint was slow.
   */
  async discoverSettings(paymentTermsDays: number): Promise<DiscoveredSettings> {
    const collection = async <T>(path: string): Promise<T[]> => {
      try {
        const res = await this.call<{ collection?: T[] }>(path);
        return res.collection ?? [];
      } catch {
        return [];
      }
    };

    const [customerGroups, vatZones, paymentTerms, layouts, products] = await Promise.all([
      collection<EconomicCustomerGroup>("/customer-groups?pagesize=100"),
      collection<EconomicVatZone>("/vat-zones?pagesize=100"),
      collection<EconomicPaymentTerm>("/payment-terms?pagesize=100"),
      collection<EconomicLayout>("/layouts?pagesize=100"),
      collection<EconomicProduct>("/products?pagesize=100"),
    ]);

    const candidates: EconomicCandidates = {
      customerGroups,
      vatZones,
      paymentTerms,
      layouts,
      products,
    };
    const chosen = chooseEconomicSettings(candidates, paymentTermsDays);
    return {
      settings: chosen.settings as unknown as Record<string, unknown>,
      choices: chosen.choices,
      complete: chosen.complete,
    };
  }

  async findCustomer(input: AccountingCustomerInput): Promise<AccountingCustomer | null> {
    const cvr = normalizeCvr(input.cvr);

    // CVR first: it is the only identifier that is stable and unambiguous.
    if (cvr) {
      const byCvr = await this.call<{ collection?: EconomicCustomerDto[] }>(
        `/customers?filter=${eqFilter("corporateIdentificationNumber", cvr)}`
      );
      const hit = byCvr.collection?.[0];
      if (hit) return toCustomer(hit, "cvr");
    }

    // Name only as a fallback, and only on an exact match. Fuzzy matching here
    // would attach invoices to the wrong company.
    const byName = await this.call<{ collection?: EconomicCustomerDto[] }>(
      `/customers?filter=${eqFilter("name", input.name)}`
    );
    const named = byName.collection?.[0];
    return named ? toCustomer(named, "name") : null;
  }

  async createCustomer(input: AccountingCustomerInput): Promise<AccountingCustomer> {
    const created = await this.call<EconomicCustomerDto>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        currency: "DKK",
        corporateIdentificationNumber: normalizeCvr(input.cvr),
        address: input.addressLine ?? undefined,
        zip: input.zipCode ?? undefined,
        city: input.city ?? undefined,
        country: input.countryCode ?? "DK",
        email: input.email ?? undefined,
        customerGroup: { customerGroupNumber: this.required("customerGroupNumber") },
        vatZone: { vatZoneNumber: this.required("vatZoneNumber") },
        paymentTerms: { paymentTermsNumber: this.required("paymentTermsNumber") },
      }),
    });
    return toCustomer(created, "created");
  }

  async createDraftInvoice(input: DraftInvoiceInput): Promise<AccountingInvoice> {
    const customerNumber = Number(input.customerExternalId);
    if (!Number.isInteger(customerNumber)) {
      throw new AccountingError(
        "INVALID_REQUEST",
        `e-conomic customer ids are numeric; got "${input.customerExternalId}".`
      );
    }

    const fallbackProduct = this.settings.fallbackProductNumber ?? null;

    const draft = await this.call<EconomicInvoiceDto>("/invoices/drafts", {
      method: "POST",
      body: JSON.stringify({
        date: input.issueDate,
        dueDate: input.dueDate,
        currency: input.currency,
        // Our own order number, so the two systems reconcile by eye.
        references: { other: input.reference },
        notes: input.notes ? { textLine1: input.notes.slice(0, 250) } : undefined,
        customer: { customerNumber },
        recipient: {
          name: input.reference,
          vatZone: { vatZoneNumber: this.required("vatZoneNumber") },
        },
        paymentTerms: { paymentTermsNumber: this.required("paymentTermsNumber") },
        layout: { layoutNumber: this.required("layoutNumber") },
        lines: input.lines.map((line, i) => ({
          lineNumber: i + 1,
          description: line.description,
          quantity: line.quantity,
          unitNetPrice: oreToAmount(line.unitPriceOre),
          discountPercentage: line.discountPct,
          // e-conomic requires a product on every invoice line. A mapped catalog
          // product wins; otherwise the agreement's ad-hoc product carries it.
          ...(line.externalProductId ?? fallbackProduct
            ? { product: { productNumber: line.externalProductId ?? fallbackProduct } }
            : {}),
        })),
      }),
    });

    return toInvoice(draft, "draft");
  }

  async getInvoice(externalId: string): Promise<AccountingInvoice | null> {
    // A draft that has been booked no longer exists as a draft: e-conomic moves
    // it to a different collection under a NEW number. Look for the booked form
    // first, so a booked invoice is never reported as still-draft.
    const booked = await this.tryGet(`/invoices/booked/${encodeURIComponent(externalId)}`);
    if (booked) return toInvoice(booked, deriveBookedStatus(booked));

    const draft = await this.tryGet(`/invoices/drafts/${encodeURIComponent(externalId)}`);
    return draft ? toInvoice(draft, "draft") : null;
  }

  private async tryGet(path: string): Promise<EconomicInvoiceDto | null> {
    try {
      return await this.call<EconomicInvoiceDto>(path);
    } catch (err) {
      if (err instanceof AccountingError && err.code === "NOT_FOUND") return null;
      throw err;
    }
  }
}

function toCustomer(
  dto: EconomicCustomerDto,
  matchedBy: AccountingCustomer["matchedBy"]
): AccountingCustomer {
  return {
    externalId: String(dto.customerNumber),
    name: dto.name,
    cvr: normalizeCvr(dto.corporateIdentificationNumber),
    matchedBy,
  };
}

/**
 * Paid vs overdue is derived, not stated.
 *
 * e-conomic reports a `remainder` — what is still outstanding. Zero means
 * settled; anything else past the due date is overdue. Deriving it here keeps
 * the three providers reporting the same vocabulary.
 */
export function deriveBookedStatus(dto: EconomicInvoiceDto, now = new Date()): InvoiceStatus {
  if (dto.remainder !== undefined && dto.remainder !== null && amountToOre(dto.remainder) <= 0) {
    return "paid";
  }
  if (dto.dueDate) {
    const due = new Date(`${dto.dueDate}T23:59:59.999Z`);
    if (!Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) return "overdue";
  }
  return "booked";
}

function toInvoice(dto: EconomicInvoiceDto, status: InvoiceStatus): AccountingInvoice {
  const externalId = dto.bookedInvoiceNumber ?? dto.draftInvoiceNumber;
  return {
    externalId: String(externalId ?? ""),
    // A draft has no legal number yet — only booking allocates one.
    invoiceNumber: dto.bookedInvoiceNumber ? String(dto.bookedInvoiceNumber) : null,
    status,
    currency: dto.currency ?? "DKK",
    totalOre: amountToOre(dto.grossAmount ?? 0),
    vatTotalOre: amountToOre(dto.vatAmount ?? 0),
    issueDate: dto.date ? dto.date.slice(0, 10) : null,
    dueDate: dto.dueDate ? dto.dueDate.slice(0, 10) : null,
    pdfUrl: dto.pdf?.download ?? null,
  };
}
