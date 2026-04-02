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
  participants?: {
    participantnumber: number;
    life: { name: string; profession: string | null };
    roles: { type: string; life: { title: string } };
  }[];
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
  limit?: string;
  page?: string;
}

export async function searchCompanies(params: SearchCompanyParams): Promise<CvrCompany[]> {
  // Separate pagination params from search filters
  const { limit: _limit, page: _page, ...filterParams } = params;

  const cleanParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(filterParams)) {
    if (value !== undefined && value !== "" && value !== "all") {
      cleanParams[key] = value;
    }
  }

  const key = cacheKey.search(cleanParams);
  const cached = await cacheGet<CvrCompany[]>(key);
  if (cached) return cached;

  // The CVR API returns ~10 results per call with no documented limit/page param.
  // We paginate by calling with page=1,2,3... until we get fewer results or hit a cap.
  const MAX_PAGES = 10; // Up to ~100 results (10 per page × 10 pages)
  const allResults: CvrCompany[] = [];
  const seen = new Set<number>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageParams = { ...cleanParams, page: String(page) };

    const data = await cvrFetch<CvrCompany[] | Record<string, unknown>>("/v2/dk/search/company", pageParams);

    let pageResults: CvrCompany[];
    if (Array.isArray(data)) {
      pageResults = data;
    } else {
      const wrapped = data as { results?: CvrCompany[] };
      pageResults = wrapped.results ?? [];
    }

    if (pageResults.length === 0) break;

    // Deduplicate by VAT
    for (const company of pageResults) {
      if (!seen.has(company.vat)) {
        seen.add(company.vat);
        allResults.push(company);
      }
    }

    // If the API returned fewer than expected (~10), we've likely exhausted results
    if (pageResults.length < 10) break;
  }

  await cacheSet(key, allResults, CACHE_TTL.search);
  return allResults;
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
  roles: {
    type: string; // accountant | board | branch_manager | daily_management | director | founder | fully_responsible_participant | liquidator | owner | real_owner | supervisory_board
    life: {
      start?: string | null;
      end?: string | null;
      title?: string | null;
      election_format?: string | null;
      owner_capital_classes?: string | null;
      owner_percent?: number | null;
      owner_voting_percent?: number | null;
      special_ownership?: string | null;
      special_ownership_description?: string | null;
      substitute_member_for_id?: number | null;
      substitute_member_for_name?: string | null;
    };
  }[];
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
