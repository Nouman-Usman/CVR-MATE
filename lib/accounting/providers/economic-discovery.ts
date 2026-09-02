/**
 * Choosing an e-conomic agreement's defaults.
 *
 * e-conomic cannot create a customer or an invoice without agreement-local
 * numbers — customer group, VAT zone, payment terms, layout — and they differ
 * per agreement, so they cannot be constants. Making a person look them up and
 * type them in is both hostile and error-prone: a wrong VAT zone silently
 * invoices the wrong amount.
 *
 * So they are discovered and pre-selected. The *selection* is pure and lives
 * here, separate from the HTTP that fetches the candidates, because picking the
 * wrong VAT zone is the expensive mistake and it deserves tests rather than a
 * live agreement.
 *
 * Nothing here is silent: `discoverEconomicSettings` returns the candidates
 * alongside the choices so the UI can show what was picked and let a human
 * change it.
 */

export interface EconomicCustomerGroup {
  customerGroupNumber: number;
  name?: string;
}

export interface EconomicVatZone {
  vatZoneNumber: number;
  name?: string;
  enabledForCustomers?: boolean;
}

export interface EconomicPaymentTerm {
  paymentTermsNumber: number;
  name?: string;
  daysOfCredit?: number;
  paymentTermsType?: string;
}

export interface EconomicLayout {
  layoutNumber: number;
  name?: string;
}

export interface EconomicProduct {
  productNumber: string;
  name?: string;
}

export interface EconomicCandidates {
  customerGroups: EconomicCustomerGroup[];
  vatZones: EconomicVatZone[];
  paymentTerms: EconomicPaymentTerm[];
  layouts: EconomicLayout[];
  products: EconomicProduct[];
}

/** Lowest number first — an agreement's defaults are conventionally its first. */
function byNumber<T>(rows: T[], key: (row: T) => number): T[] {
  return [...rows].sort((a, b) => key(a) - key(b));
}

function nameOf(row: { name?: string }): string {
  return (row.name ?? "").toLowerCase();
}

/**
 * The domestic VAT zone.
 *
 * The most consequential choice here: pick the EU or abroad zone and every
 * invoice goes out zero-rated. Matched on name in both languages, because the
 * numbering is not guaranteed — falling back to the lowest number only when no
 * name matches, and reporting low confidence when that happens.
 */
export function pickVatZone(zones: EconomicVatZone[]): {
  zone: EconomicVatZone | null;
  confident: boolean;
} {
  const usable = zones.filter((z) => z.enabledForCustomers !== false);
  const pool = usable.length > 0 ? usable : zones;
  if (pool.length === 0) return { zone: null, confident: false };

  const domestic = pool.find((z) => {
    const n = nameOf(z);
    return n.includes("domestic") || n.includes("indland") || n.includes("dansk");
  });
  if (domestic) return { zone: domestic, confident: true };

  // No recognisable name. Take the lowest number but say so — the caller
  // surfaces it rather than quietly invoicing at whatever this turns out to be.
  return { zone: byNumber(pool, (z) => z.vatZoneNumber)[0], confident: false };
}

/**
 * Payment terms matching the organization's net days.
 *
 * Exact match on days first, and only among "net"-type terms — e-conomic also
 * models prepaid and end-of-month terms, and silently invoicing on those would
 * change when the customer actually owes money.
 */
export function pickPaymentTerms(
  terms: EconomicPaymentTerm[],
  wantedDays: number
): { term: EconomicPaymentTerm | null; confident: boolean } {
  if (terms.length === 0) return { term: null, confident: false };

  const isNet = (t: EconomicPaymentTerm) => {
    const type = (t.paymentTermsType ?? "").toLowerCase();
    // e-conomic spells this "net"; Danish agreements show "netto".
    return type === "" || type.includes("net");
  };

  const exact = terms.find((t) => isNet(t) && t.daysOfCredit === wantedDays);
  if (exact) return { term: exact, confident: true };

  const anyDays = terms.find((t) => t.daysOfCredit === wantedDays);
  if (anyDays) return { term: anyDays, confident: false };

  return { term: byNumber(terms, (t) => t.paymentTermsNumber)[0], confident: false };
}

/**
 * A product to carry ad-hoc invoice lines.
 *
 * e-conomic requires a product on every invoice line, but a CVR-MATE order line
 * may be free text with no catalog entry behind it. Prefer something that looks
 * deliberately generic; otherwise return null rather than picking an arbitrary
 * real product, because invoicing consultancy hours against "Skruer 4mm" would
 * corrupt the customer's own reporting.
 */
export function pickFallbackProduct(products: EconomicProduct[]): {
  product: EconomicProduct | null;
  confident: boolean;
} {
  const generic = products.find((p) => {
    const n = `${p.productNumber} ${nameOf(p)}`.toLowerCase();
    return (
      n.includes("misc") ||
      n.includes("diverse") ||
      n.includes("ydelse") ||
      n.includes("service") ||
      n.includes("konsulent") ||
      n.includes("timer")
    );
  });
  if (generic) return { product: generic, confident: true };
  return { product: null, confident: false };
}

export interface SettingsChoice {
  key: string;
  /** What was chosen, as a human-readable label. */
  selectedLabel: string;
  selectedValue: string | null;
  /** False when the pick was a guess and a person should look at it. */
  confident: boolean;
  options: Array<{ value: string; label: string }>;
}

export interface DiscoveredEconomicSettings {
  settings: {
    customerGroupNumber: number | null;
    vatZoneNumber: number | null;
    paymentTermsNumber: number | null;
    layoutNumber: number | null;
    fallbackProductNumber: string | null;
  };
  choices: SettingsChoice[];
  /** True when every choice was confident and non-null. */
  complete: boolean;
}

/** Turn raw agreement data into a pre-filled, reviewable configuration. */
export function chooseEconomicSettings(
  candidates: EconomicCandidates,
  wantedPaymentTermsDays: number
): DiscoveredEconomicSettings {
  const group = byNumber(candidates.customerGroups, (g) => g.customerGroupNumber)[0] ?? null;
  const { zone, confident: zoneConfident } = pickVatZone(candidates.vatZones);
  const { term, confident: termConfident } = pickPaymentTerms(
    candidates.paymentTerms,
    wantedPaymentTermsDays
  );
  const layout = byNumber(candidates.layouts, (l) => l.layoutNumber)[0] ?? null;
  const { product, confident: productConfident } = pickFallbackProduct(candidates.products);

  const choices: SettingsChoice[] = [
    {
      key: "customerGroupNumber",
      selectedValue: group ? String(group.customerGroupNumber) : null,
      selectedLabel: group ? (group.name ?? `#${group.customerGroupNumber}`) : "—",
      confident: Boolean(group),
      options: candidates.customerGroups.map((g) => ({
        value: String(g.customerGroupNumber),
        label: g.name ?? `#${g.customerGroupNumber}`,
      })),
    },
    {
      key: "vatZoneNumber",
      selectedValue: zone ? String(zone.vatZoneNumber) : null,
      selectedLabel: zone ? (zone.name ?? `#${zone.vatZoneNumber}`) : "—",
      confident: zoneConfident,
      options: candidates.vatZones.map((z) => ({
        value: String(z.vatZoneNumber),
        label: z.name ?? `#${z.vatZoneNumber}`,
      })),
    },
    {
      key: "paymentTermsNumber",
      selectedValue: term ? String(term.paymentTermsNumber) : null,
      selectedLabel: term ? (term.name ?? `#${term.paymentTermsNumber}`) : "—",
      confident: termConfident,
      options: candidates.paymentTerms.map((t) => ({
        value: String(t.paymentTermsNumber),
        label: t.name ?? `#${t.paymentTermsNumber}`,
      })),
    },
    {
      key: "layoutNumber",
      selectedValue: layout ? String(layout.layoutNumber) : null,
      selectedLabel: layout ? (layout.name ?? `#${layout.layoutNumber}`) : "—",
      confident: Boolean(layout),
      options: candidates.layouts.map((l) => ({
        value: String(l.layoutNumber),
        label: l.name ?? `#${l.layoutNumber}`,
      })),
    },
    {
      key: "fallbackProductNumber",
      selectedValue: product ? product.productNumber : null,
      selectedLabel: product ? (product.name ?? product.productNumber) : "—",
      confident: productConfident,
      options: candidates.products.map((p) => ({
        value: p.productNumber,
        label: p.name ? `${p.productNumber} — ${p.name}` : p.productNumber,
      })),
    },
  ];

  return {
    settings: {
      customerGroupNumber: group?.customerGroupNumber ?? null,
      vatZoneNumber: zone?.vatZoneNumber ?? null,
      paymentTermsNumber: term?.paymentTermsNumber ?? null,
      layoutNumber: layout?.layoutNumber ?? null,
      fallbackProductNumber: product?.productNumber ?? null,
    },
    choices,
    complete: choices.every((c) => c.confident && c.selectedValue !== null),
  };
}
