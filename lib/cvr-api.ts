import "server-only";

import { cacheGet, cacheSet } from "@/lib/redis";
import { cacheKey, CACHE_TTL } from "@/lib/cache";

const CVR_BASE_URL = "https://rest.cvrapi.dk";

function getAuthHeader(): string {
  const apiKey = process.env.CVR_API_KEY;
  if (!apiKey) throw new Error("CVR_API_KEY is not configured");
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

async function cvrFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${CVR_BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: getAuthHeader(),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`CVR API ${res.status}: ${text}`);
  }

  return res.json();
}

// --- Company ---

export interface CvrCompany {
  vat: number;
  slug: string;
  address: {
    street: string | null;
    zipcode: number | null;
    cityname: string | null;
    municipalityname: string | null;
  };
  companyform: {
    code: number | null;
    description: string | null;
    longdescription: string | null;
    holding: boolean;
  };
  companystatus: {
    text: string | null;
    start: string | null;
  };
  contact: {
    email: string | null;
    www: string | null;
    phone: string | null;
  };
  status: {
    code: number | null;
    bankrupt: boolean;
  };
  industry: {
    primary: { code: number | null; text: string | null };
    secondary: { sequence: number; code: number; text: string }[];
  };
  life: {
    start: string | null;
    end: string | null;
    name: string;
    adprotected: boolean;
  };
  accounting?: {
    // The registry's fiscal-year fields. cvrFetch ends in a bare res.json()
    // cast, so these have always arrived at runtime — declaring them just
    // stops server code having to re-cast to reach them.
    /** Recurring fiscal-year start as XSD gMonthDay, e.g. "--10-01". */
    period_start?: string | null;
    /** Recurring fiscal-year end as XSD gMonthDay, e.g. "--09-30". */
    period_end?: string | null;
    /** First accounting period — full dates, e.g. "2021-04-08". */
    first_period_start?: string | null;
    first_period_end?: string | null;
    revision?: boolean;
    documents?: {
      summary?: {
        revenue: number | null;
        grossprofitloss: number | null;
        profitloss: number | null;
        equity: number | null;
        assets: number | null;
        averagenumberofemployees: number | null;
      };
    }[];
  };
  employment?: {
    months?: { amount: number | null; interval_low: number | null; interval_high: number | null; year: number; month: number }[];
    quarters?: { amount: number | null; interval_low: number | null; interval_high: number | null; year: number; quarter: number }[];
    years?: { amount: number | null; interval_low: number | null; interval_high: number | null; year: number }[];
  };
  info?: {
    capital_amount: number | null;
    capital_currency: string | null;
    purpose: string | null;
  };
  participants?: CvrParticipantRole[];
  /**
   * Companies this company holds a role in — the downward ownership edge.
   * Same role shape as `participants`, so `owner_percent` lives in the same
   * place in both directions.
   */
  participations?: CvrParticipation[];
  /**
   * PRODUKTIONSENHEDER (P-units), NOT owned companies. Every entry repeats
   * this company's own `vat` and identifies itself by `subsidiarynumber`
   * (a P-number). Novo Nordisk has 220. Do not treat these as ownership —
   * see docs/superpowers/specs/2026-08-19-ownership-diagram-design.md.
   */
  subsidiaries?: {
    subsidiarynumber: number;
    vat: number;
    slug?: string;
    life?: { name?: string | null; start?: string | null; end?: string | null };
    address?: { street?: string | null; zipcode?: number | null; cityname?: string | null; municipalityname?: string | null };
  }[];
}

/**
 * One party related to a company: a person (`participantnumber` + `participant`)
 * or another company (`vat` + `company`). `roles` is an ARRAY — a single party
 * commonly holds several at once (founder AND owner is the usual pair).
 */
export interface CvrParticipantRole {
  participantnumber?: number;
  vat?: number;
  slug?: string;
  /** True when this party is a company. Mutually exclusive with `participant`. */
  company?: boolean;
  /** True when this party is a natural person. */
  participant?: boolean;
  companyform?: {
    code?: number | null;
    description?: string | null;
    longdescription?: string | null;
    holding?: boolean;
  };
  companystatus?: { text?: string | null; start?: string | null };
  address?: {
    street?: string | null;
    zipcode?: number | null;
    cityname?: string | null;
    countrycode?: string | null;
    freetext?: string | null;
    unlisted?: boolean;
  };
  life: {
    name: string;
    profession?: string | null;
    deceased?: boolean;
    adprotected?: boolean;
  };
  roles: CvrRole[];
}

export interface CvrRole {
  /** accountant | board | branch_manager | daily_management | director | founder
   *  | fully_responsible_participant | liquidator | owner | real_owner | supervisory_board */
  type: string;
  life: {
    start?: string | null;
    /** Non-null means the role has ENDED — historical, not current. */
    end?: string | null;
    title?: string | null;
    election_format?: string | null;
    owner_capital_classes?: string | null;
    /** A PERCENT (0–100), not a fraction. The CVR distribution's
     *  EJERANDEL_PROCENT is a fraction — never mix the two sources. */
    owner_percent?: number | null;
    owner_voting_percent?: number | null;
    special_ownership?: string | null;
    special_ownership_description?: string | null;
    substitute_member_for_id?: number | null;
    substitute_member_for_name?: string | null;
  };
}

/**
 * Human-readable label for the roles a party holds at a company, e.g.
 * "Direktør" or "Stifter, Ejer".
 *
 * Exists because `roles` is an ARRAY and every caller used to read it as a
 * single object (`p.roles?.life?.title`), which evaluates to `undefined` and
 * silently fell through to "Unknown". Every AI prompt that listed participants
 * was therefore describing all of them as roleless.
 *
 * Prefers the registry's own title; falls back to the raw role type. Ended
 * roles are dropped unless a party has nothing else — a former director is
 * still better than no label at all.
 */
export function roleLabel(roles: CvrRole[] | null | undefined): string | null {
  const all = roles ?? [];
  const active = all.filter((r) => r.life?.end == null);
  const source = active.length > 0 ? active : all;

  const labels = source
    .map((r) => r.life?.title?.trim() || r.type?.trim())
    .filter((v): v is string => Boolean(v));

  return labels.length > 0 ? [...new Set(labels)].join(", ") : null;
}

/** True when any of a party's roles matches `needle` by title or type. */
export function hasRoleMatching(
  roles: CvrRole[] | null | undefined,
  needle: string
): boolean {
  const q = needle.toLowerCase();
  return (roles ?? []).some(
    (r) =>
      r.life?.title?.toLowerCase().includes(q) || r.type?.toLowerCase().includes(q)
  );
}

export async function getCompanyByVat(vat: number): Promise<CvrCompany> {
  const key = cacheKey.company(vat);
  const cached = await cacheGet<CvrCompany>(key);
  if (cached) return cached;

  const data = await cvrFetch<CvrCompany>(`/v2/dk/company/${vat}`);
  await cacheSet(key, data, CACHE_TTL.company);
  return data;
}

// All parameter names match the CVR API v2 query params exactly (underscore-separated).
// See: GET /v2/{country}/search/company
export interface SearchCompanyParams {
  life_name?: string;
  life_start?: string;
  life_end?: string;
  life_adprotected?: string;
  address_street?: string;
  address_streetcode?: string;
  address_numberfrom?: string;
  address_letterfrom?: string;
  address_zipcode?: string;
  address_zipcode_list?: string;
  address_city?: string;
  address_municipality?: string;
  companyform_code?: string;
  companyform_description?: string;
  companyform_holding?: string;
  companystatus_code?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_www?: string;
  status_bankrupt?: string;
  industry_primary_text?: string;
  industry_primary_code?: string;
  industry_secondary_text?: string;
  industry_secondary_code?: string;
  capital_capital?: string;
  capital_currency?: string;
  capital_ipo?: string;
  employment_amount?: string;
  employment_interval_low?: string;
  info_ean_id?: string;
  info_lei_id?: string;
  // Undocumented but used by the recent companies route
  limit?: string;
  page?: string;
}

export async function searchCompanies(params: SearchCompanyParams): Promise<CvrCompany[]> {
  const cleanParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== "all") {
      cleanParams[key] = value;
    }
  }

  // Cache is per-page (page param is part of cleanParams)
  const key = cacheKey.search(cleanParams);
  const cached = await cacheGet<CvrCompany[]>(key);
  if (cached) return cached;

  const data = await cvrFetch<CvrCompany[]>("/v2/dk/search/company", cleanParams);
  let results: CvrCompany[];
  if (Array.isArray(data)) {
    results = data;
  } else {
    const wrapped = data as unknown as { results?: CvrCompany[] };
    results = wrapped.results ?? [];
  }

  await cacheSet(key, results, CACHE_TTL.search);
  return results;
}

// --- Participant ---
// Matches the official CVR API v2 Participant schema (pages 25-26 of docs)

export interface CvrParticipantRaw {
  participantnumber: number;
  slug: string;
  address?: {
    street?: string | null;
    streetcode?: number | null;
    numberfrom?: string | null;
    zipcode?: number | null;
    cityname?: string | null;
    countrycode?: string | null;
    freetext?: string | null;
    municipalityname?: string | null;
    unlisted?: boolean;
  };
  contact?: {
    email?: string | null;
    www?: string | null;
    phone?: string | null;
  };
  attributes?: {
    type: string; // "original_citizenship"
    life: { value: string };
  };
  life: {
    name: string;
    profession?: string | null;
    deceased?: boolean;
  };
  // The CVR API returns the participant's company affiliations under the
  // confusingly-named `roles` field — each entry is a full CvrParticipation
  // (company info + that person's roles in that company). The `participations`
  // alias is kept for backward compat in case the API ever exposes it.
  roles?: CvrParticipation[];
  participations?: CvrParticipation[];
}

// Enriched participant data returned by our API route (participant + company relations)
export interface CvrParticipant extends CvrParticipantRaw {
  companies: CvrParticipation[];
}

// Matches the official CVR API v2 Participations schema (pages 46-47 of docs)
export interface CvrParticipation {
  vat: number;
  slug: string;
  companyform?: {
    code?: number | null;
    description: string | null;
    longdescription?: string | null;
    holding?: boolean;
  };
  companystatus?: { text: string | null; start?: string | null };
  life: {
    start?: string | null;
    end?: string | null;
    name: string;
    adprotected?: boolean;
  };
  // Structurally identical to the role shape on `participants` — same field in
  // both directions, so both sides share one type.
  roles: CvrRole[];
}

export async function getParticipantByNumber(participantnumber: number): Promise<CvrParticipantRaw> {
  const key = cacheKey.participant(participantnumber);
  const cached = await cacheGet<CvrParticipantRaw>(key);
  if (cached) return cached;

  const data = await cvrFetch<CvrParticipantRaw>(`/v2/dk/participant/${participantnumber}`);
  await cacheSet(key, data, CACHE_TTL.participant);
  return data;
}

// Fetch a full company to extract its participations for a given participant
export async function getCompanyParticipations(vat: number): Promise<CvrParticipation[]> {
  const company = await getCompanyByVat(vat);
  return ((company as unknown as Record<string, unknown>).participations ?? []) as CvrParticipation[];
}

/** CVR API may return `roles` as a single object or an array. Normalize to array. */
export function normalizeRoles(roles: unknown): CvrParticipation["roles"] {
  if (Array.isArray(roles)) return roles;
  if (roles && typeof roles === "object" && "type" in (roles as Record<string, unknown>))
    return [roles as CvrParticipation["roles"][0]];
  return [];
}

/**
 * Given a full company response and a participant number, extract that
 * participant's roles and build a CvrParticipation entry for this company.
 *
 * A person with multiple roles may appear as multiple entries in participants[].
 * This function merges all entries into a single CvrParticipation with a roles array.
 */
export function extractParticipantFromCompany(
  company: CvrCompany,
  participantnumber: number
): CvrParticipation | null {
  const raw = company as unknown as Record<string, unknown>;
  const participants = (raw.participants ?? []) as {
    participantnumber?: number;
    vat?: number;
    roles: unknown;
  }[];

  const matches = participants.filter(
    (p) => p.participantnumber === participantnumber
  );

  if (matches.length === 0) return null;

  const mergedRoles: CvrParticipation["roles"] = [];
  for (const m of matches) {
    mergedRoles.push(...normalizeRoles(m.roles));
  }

  return {
    vat: company.vat,
    slug: company.slug,
    companyform: company.companyform,
    companystatus: company.companystatus,
    life: company.life,
    roles: mergedRoles,
  };
}

// --- Change Feed ---

export interface ChangedCompanyEntry {
  vat: number;
  change_id: number;
}

/** Fetch companies that changed since a given change_id. No caching — must be real-time. */
export async function getChangedCompanies(sinceChangeId: number): Promise<ChangedCompanyEntry[]> {
  return cvrFetch<ChangedCompanyEntry[]>(`/v2/dk/changed/list/company/${sinceChangeId}`);
}

/** Like getCompanyByVat but bypasses Redis cache. Used by cron worker for accurate diffing. */
export async function getCompanyByVatFresh(vat: number): Promise<CvrCompany> {
  const data = await cvrFetch<CvrCompany>(`/v2/dk/company/${vat}`);
  // Update cache with fresh data
  const key = cacheKey.company(vat);
  await cacheSet(key, data, CACHE_TTL.company);
  return data;
}

export async function suggestCompanies(name: string): Promise<CvrCompany[]> {
  if (!name || name.length < 2) return [];

  const key = cacheKey.suggest(name);
  const cached = await cacheGet<CvrCompany[]>(key);
  if (cached) return cached;

  const data = await cvrFetch<CvrCompany[]>(`/v2/dk/suggestions/company/${encodeURIComponent(name)}`);
  await cacheSet(key, data, CACHE_TTL.suggest);
  return data;
}
