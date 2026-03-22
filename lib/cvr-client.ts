// Client-side functions to call our Next.js API routes (NOT the CVR API directly)
// This ensures the CVR_API_KEY never reaches the browser.

export interface CvrCompanyResult {
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
    years?: {
      amount: number | null;
      interval_low: number | null;
      interval_high: number | null;
      year: number;
    }[];
  }[];
}

export interface SearchFilters {
  name?: string;
  industry_text?: string;
  industry_code?: string;
  companyform_code?: string;
  zipcode?: string;
  zipcode_list?: string;
  city?: string;
  employment_interval_low?: string;
  employment_amount?: string;
  life_start?: string;
  life_end?: string;
  companystatus_code?: string;
  bankrupt?: string;
}

export async function searchCompanies(
  filters: SearchFilters
): Promise<{ results: CvrCompanyResult[]; count: number; error?: string }> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== "all") params.set(key, value);
  }

  const res = await fetch(`/api/cvr/search?${params.toString()}`);
  return res.json();
}

export async function getCompany(
  vat: string
): Promise<{ company?: CvrCompanyResult; error?: string }> {
  const res = await fetch(`/api/cvr/company?vat=${vat}`);
  return res.json();
}

export async function suggestCompanies(
  query: string
): Promise<{ results: CvrCompanyResult[] }> {
  if (!query || query.length < 2) return { results: [] };
  const res = await fetch(
    `/api/cvr/suggest?q=${encodeURIComponent(query)}`
  );
  return res.json();
}

export async function getRecentCompanies(
  days = 30
): Promise<{ results: CvrCompanyResult[]; count: number; error?: string }> {
  const res = await fetch(`/api/cvr/recent?days=${days}`);
  return res.json();
}

// Helper to extract a flat company object from CvrCompanyResult
export function flattenCompany(c: CvrCompanyResult) {
  const latestEmployment = c.employment?.[0]?.years?.[0];
  return {
    cvr: String(c.vat),
    name: c.life?.name || c.slug || String(c.vat),
    city: c.address?.cityname || "",
    zipcode: c.address?.zipcode ? String(c.address.zipcode) : "",
    street: c.address?.street || "",
    industry: c.industry?.primary?.text || "",
    industryCode: c.industry?.primary?.code
      ? String(c.industry.primary.code)
      : "",
    companyForm: c.companyform?.description || "",
    status: c.companystatus?.text || "",
    founded: c.life?.start || "",
    employees: latestEmployment?.amount
      ? String(latestEmployment.amount)
      : latestEmployment?.interval_low
        ? `${latestEmployment.interval_low}-${latestEmployment.interval_high}`
        : "",
    email: c.contact?.email || "",
    phone: c.contact?.phone || "",
    website: c.contact?.www || "",
    bankrupt: c.status?.bankrupt || false,
    adprotected: c.life?.adprotected || false,
  };
}
