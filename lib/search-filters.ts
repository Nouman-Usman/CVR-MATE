export interface SearchFiltersState {
  // Identity
  query: string;
  cvrNumber: string;
  foundedPeriod: string;
  // Industry
  industryCode: string;
  industrySecondaryCode: string;
  // Address
  street: string;
  numberFrom: string;
  zipcode: string;
  region: string;
  city: string;
  municipality: string;
  // Contact
  contactPhone: string;
  contactEmail: string;
  contactWww: string;
  // Legal
  companyformCode: string;
  companystatusCode: string;
  // Compliance
  skipMarketingOptOut: boolean;
}

type SearchParamReader = Pick<URLSearchParams, "get">;

export const DEFAULT_SEARCH_FILTERS: SearchFiltersState = {
  query: "",
  cvrNumber: "",
  foundedPeriod: "all",
  industryCode: "all",
  industrySecondaryCode: "",
  street: "",
  numberFrom: "",
  zipcode: "",
  region: "all",
  city: "",
  municipality: "",
  contactPhone: "",
  contactEmail: "",
  contactWww: "",
  companyformCode: "",
  companystatusCode: "",
  skipMarketingOptOut: false,
};

// All Denmark geo data (regions, cities, zipcodes) lives in denmark-geodata.ts
import { regionZipcodeMap as _regionZipcodeMap } from "@/lib/denmark-geodata";
export { regionCityZipcodeMap, regionCityMap, regionZipcodeMap, zipcodeToRegionCity } from "@/lib/denmark-geodata";
export type { DenmarkCity } from "@/lib/denmark-geodata";

// CVR numbers are 8 digits; users paste them with spaces/dots ("12 34 56 78", "12.34.56.78")
export function normalizeCvr(value: string): string {
  return value.replace(/\D/g, "");
}

export function isCvrNumber(value: string): boolean {
  return /^\d{8}$/.test(normalizeCvr(value));
}

// Explicit CVR field wins; otherwise an 8-digit free-text query is an implicit CVR lookup.
// Returns "" when the state does not describe a CVR lookup.
export function resolveCvr(filters: Pick<SearchFiltersState, "cvrNumber" | "query">): string {
  if (filters.cvrNumber && isCvrNumber(filters.cvrNumber)) return normalizeCvr(filters.cvrNumber);
  if (isCvrNumber(filters.query)) return normalizeCvr(filters.query);
  return "";
}

function foundedToDate(period: string): string | null {
  if (period === "all") return null;
  const map: Record<string, number> = { last30: 30, last90: 90, last365: 365, last3y: 1095 };
  const days = map[period];
  if (!days) return null;
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().split("T")[0];
}

export function mergeSearchFilters(
  filters: Partial<SearchFiltersState>,
  base: SearchFiltersState = DEFAULT_SEARCH_FILTERS
): SearchFiltersState {
  return { ...base, ...filters };
}

export function hasNativeSearchFilter(filters: SearchFiltersState): boolean {
  return !!(
    filters.query ||
    filters.cvrNumber ||
    filters.industryCode !== "all" ||
    filters.industrySecondaryCode ||
    filters.street ||
    filters.numberFrom ||
    filters.zipcode ||
    filters.region !== "all" ||
    filters.city ||
    filters.municipality ||
    filters.contactPhone ||
    filters.contactEmail ||
    filters.contactWww ||
    filters.companyformCode ||
    filters.companystatusCode ||
    filters.foundedPeriod !== "all"
  );
}

export function buildSearchParamsFromState(filters: SearchFiltersState): URLSearchParams | null {
  const params = new URLSearchParams();

  // A CVR number is a unique key, so the lookup is exclusive: every other filter can only
  // exclude the one true match. Short-circuit before any of them are applied.
  const cvr = resolveCvr(filters);
  if (cvr) {
    const cvrParams = new URLSearchParams();
    cvrParams.set("cvr", cvr);
    return cvrParams;
  }

  if (filters.query) params.set("name", filters.query);
  if (filters.industryCode !== "all") params.set("industry_code", filters.industryCode);
  if (filters.industrySecondaryCode) params.set("industry_secondary_code", filters.industrySecondaryCode);
  if (filters.street) params.set("street", filters.street);
  if (filters.numberFrom) params.set("number_from", filters.numberFrom);

  if (filters.zipcode) {
    params.set("zipcode", filters.zipcode);
  } else if (filters.region !== "all") {
    const zips = _regionZipcodeMap[filters.region];
    if (zips) params.set("zipcode_list", zips);
  }

  if (filters.city) params.set("city", filters.city);
  if (filters.municipality) params.set("municipality", filters.municipality);
  if (filters.contactPhone) params.set("phone", filters.contactPhone);
  if (filters.contactEmail) params.set("email", filters.contactEmail);
  if (filters.contactWww) params.set("website", filters.contactWww);

  const lifeStart = foundedToDate(filters.foundedPeriod);
  if (lifeStart) params.set("life_start", lifeStart);

  if (filters.companyformCode) params.set("companyform_code", filters.companyformCode);

  // Suppress dissolved/inactive status on recently founded companies — logically inconsistent
  const isRecentFounded = filters.foundedPeriod === "last30" || filters.foundedPeriod === "last90";
  const isActiveStatus = !filters.companystatusCode || ["NORMAL", "AKTIV"].includes(filters.companystatusCode);
  if (filters.companystatusCode && !(isRecentFounded && !isActiveStatus)) {
    params.set("companystatus_code", filters.companystatusCode);
  }

  if (params.toString().length === 0) return null;

  // "true" = exclude companies with reklamebeskyttet=true (opted out of marketing)
  if (filters.skipMarketingOptOut) params.set("ad_protected", "true");

  return params;
}

export function serializeSearchFilters(filters: SearchFiltersState): Record<string, string> {
  const s: Record<string, string> = {};
  if (filters.query) s.name = filters.query;
  if (filters.cvrNumber) s.cvr = filters.cvrNumber;
  if (filters.industryCode !== "all") s.industry_code = filters.industryCode;
  if (filters.industrySecondaryCode) s.industry_secondary_code = filters.industrySecondaryCode;
  if (filters.street) s.street = filters.street;
  if (filters.numberFrom) s.numberFrom = filters.numberFrom;
  if (filters.zipcode) s.zipcode = filters.zipcode;
  if (filters.region !== "all") s.region = filters.region;
  if (filters.city) s.city = filters.city;
  if (filters.municipality) s.municipality = filters.municipality;
  if (filters.contactPhone) s.contactPhone = filters.contactPhone;
  if (filters.contactEmail) s.contactEmail = filters.contactEmail;
  if (filters.contactWww) s.contactWww = filters.contactWww;
  if (filters.companyformCode) s.companyform_code = filters.companyformCode;
  if (filters.companystatusCode) s.companystatus_code = filters.companystatusCode;
  if (filters.foundedPeriod !== "all") s.foundedPeriod = filters.foundedPeriod;
  s.skipMarketingOptOut = filters.skipMarketingOptOut ? "true" : "false";
  return s;
}

export function hydrateSearchFiltersFromParams(params: SearchParamReader): {
  filters: Partial<SearchFiltersState>;
  hasParams: boolean;
} {
  const filters: Partial<SearchFiltersState> = {};

  const stringMappings: Array<[keyof SearchFiltersState, string]> = [
    ["query", "name"],
    ["cvrNumber", "cvr"],
    ["industryCode", "industry_code"],
    ["industrySecondaryCode", "industry_secondary_code"],
    ["street", "street"],
    ["numberFrom", "numberFrom"],
    ["zipcode", "zipcode"],
    ["region", "region"],
    ["city", "city"],
    ["municipality", "municipality"],
    ["contactPhone", "contactPhone"],
    ["contactEmail", "contactEmail"],
    ["contactWww", "contactWww"],
    ["companyformCode", "companyform_code"],
    ["companystatusCode", "companystatus_code"],
    ["foundedPeriod", "foundedPeriod"],
  ];

  for (const [stateKey, paramKey] of stringMappings) {
    const value = params.get(paramKey);
    if (value) filters[stateKey] = value as never;
  }

  const skipMarketingOptOut = params.get("skipMarketingOptOut");
  if (skipMarketingOptOut === "false") filters.skipMarketingOptOut = false;
  else if (skipMarketingOptOut === "true") filters.skipMarketingOptOut = true;

  return {
    filters,
    hasParams: Object.keys(filters).length > 0,
  };
}
