/**
 * The CRM query-key namespace.
 *
 * Keys used to be inlined as bare arrays at every call site, which is how the
 * cache developed holes nobody could see: creating an interaction never
 * invalidated the org-wide feed, quote mutations never invalidated the company
 * activity timeline they wrote to, and contract mutations refreshed the expiry
 * report but not the segments report that also sums contract value. Meanwhile
 * every quote mutation invalidated `["orders"]` even when no order could change.
 *
 * Declaring keys here does not fix that by itself — `crmInvalidations` below is
 * the actual map, kept in one place so it can be reviewed as a unit.
 */

export const qk = {
  // Lists
  quotes: () => ["quotes"] as const,
  orders: () => ["orders"] as const,
  products: () => ["products"] as const,
  segments: () => ["segments"] as const,
  interactionsFeed: () => ["interactions-feed"] as const,
  recordsSearch: (q: string) => ["records-search", q] as const,
  /** Prefix — invalidates every cached search term at once. */
  recordsSearchAll: () => ["records-search"] as const,

  // Single documents
  quote: (id: string) => ["quote", id] as const,
  order: (id: string) => ["order", id] as const,

  // Company-scoped
  companyContacts: (vat: string) => ["contacts", vat] as const,
  companyNotes: (vat: string) => ["company-notes", vat] as const,
  companyActivity: (vat: string) => ["company-activity", vat] as const,
  companyInteractions: (vat: string) => ["company-interactions", vat] as const,
  companyContracts: (vat: string) => ["company-contracts", vat] as const,
  companySegments: (vat: string) => ["company-segments", vat] as const,
  companyDocuments: (vat: string) => ["company-documents", vat] as const,

  // Pipeline (owned by use-pipeline.ts — mirrored here so CRM mutations that
  // move deal money can invalidate them without importing that module).
  deal: (id: string) => ["deal", id] as const,
  boards: () => ["board"] as const,

  // Reports
  reportContractExpiry: () => ["report-contract-expiry"] as const,
  reportSegments: () => ["report-segments"] as const,

  // Misc
  todos: () => ["todos"] as const,
  savedCompanies: () => ["saved-companies"] as const,
} as const;

type QueryClientLike = {
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => unknown;
};

/**
 * Invalidate a set of keys. Takes the client rather than being a hook so it can
 * be called from `onSettled` callbacks.
 */
export function invalidate(qc: QueryClientLike, keys: readonly (readonly unknown[])[]): void {
  for (const queryKey of keys) qc.invalidateQueries({ queryKey });
}

/**
 * Mutation → keys it must invalidate. One place to review, one place to fix.
 *
 * `companyVat` and `dealId` are optional because not every mutation response
 * carries them; when absent the company-scoped keys are simply skipped, which is
 * correct (nothing company-scoped is cached for a company we cannot name).
 */
export const crmInvalidations = {
  quoteCreated: (vat?: string) => [qk.quotes(), ...(vat ? [qk.companyActivity(vat), qk.companyDocuments(vat)] : [])],

  quoteUpdated: (id: string, vat?: string) => [
    qk.quote(id),
    qk.quotes(),
    ...(vat ? [qk.companyActivity(vat), qk.companyDocuments(vat)] : []),
  ],

  // Accepting rolls the quote total into deal.amount server-side, so the board
  // and the deal drawer are stale until these run.
  quoteStatusChanged: (id: string, vat?: string, dealId?: string | null) => [
    qk.quote(id),
    qk.quotes(),
    ...(vat ? [qk.companyActivity(vat), qk.companyDocuments(vat)] : []),
    ...(dealId ? [qk.deal(dealId)] : []),
    qk.boards(),
  ],

  // The only quote mutation that genuinely creates an order.
  quoteConverted: (id: string, vat?: string) => [
    qk.quote(id),
    qk.quotes(),
    qk.orders(),
    ...(vat ? [qk.companyActivity(vat), qk.companyDocuments(vat)] : []),
  ],

  orderUpdated: (id: string, vat?: string) => [
    qk.order(id),
    qk.orders(),
    ...(vat ? [qk.companyDocuments(vat)] : []),
  ],

  interactionChanged: (vat: string) => [
    qk.companyInteractions(vat),
    qk.companyActivity(vat),
    qk.interactionsFeed(),
    qk.todos(),
  ],

  contractChanged: (vat: string) => [
    qk.companyContracts(vat),
    qk.companyActivity(vat),
    qk.reportContractExpiry(),
    qk.reportSegments(),
  ],

  segmentChanged: (vat?: string) => [
    qk.segments(),
    qk.reportSegments(),
    ...(vat ? [qk.companySegments(vat)] : []),
  ],

  productChanged: () => [qk.products()],

  prospectCreated: (vat: string) => [
    qk.companyContacts(vat),
    qk.companyActivity(vat),
    qk.savedCompanies(),
    qk.recordsSearchAll(),
  ],
} as const;
