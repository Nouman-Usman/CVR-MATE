import { regionZipcodeMap } from "@/lib/search-filters";

// Maps stored text/abbreviation company type values → numeric ES form codes
function resolveCompanyFormCode(value: string): string | null {
  if (/^\d+$/.test(value)) return value; // already numeric
  const map: Record<string, string> = {
    aps: "80",
    anpartsselskab: "80",
    "a/s": "60",
    aktieselskab: "60",
    enk: "10",
    enkeltmandsvirksomhed: "10",
    "i/s": "30",
    interessentskab: "30",
    "k/s": "40",
    kommanditselskab: "40",
    "p/s": "150",
    fond: "90",
    forening: "200",
  };
  return map[value.toLowerCase()] ?? null;
}

/**
 * Maps TriggerFilters (stored as JSONB in DB) to ES filter keys
 * understood by searchCompaniesElasticsearch / buildEsQuery.
 *
 * TriggerFilter keys: industry_code, branch_code, city, region,
 *   company_type, min_employees, max_employees, founded_after
 */
export function buildEsFilters(filters: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};

  // branch_code takes priority over industry_code (more specific)
  const industryCode = filters.branch_code || filters.industry_code;
  if (industryCode) out.industry_primary_code = String(industryCode);

  if (filters.city) out.city = String(filters.city);

  if (filters.region) {
    const region = String(filters.region).toLowerCase();
    const zips = regionZipcodeMap[region];
    if (zips) out.zipcode_list = zips;
  }

  if (filters.company_type) {
    const code = resolveCompanyFormCode(String(filters.company_type));
    if (code) out.companyform_code = code;
  }

  // min_employees / max_employees have no ES equivalent — omitted

  if (filters.founded_after) out.life_start = String(filters.founded_after);

  return out;
}
