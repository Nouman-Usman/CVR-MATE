import "server-only";

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
    next: { revalidate: 60 },
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
  return cvrFetch<CvrCompany>(`/v2/dk/company/${vat}`);
}

export interface SearchCompanyParams {
  life_name?: string;
  life_start?: string;
  life_end?: string;
  address_zipcode?: string;
  address_zipcode_list?: string;
  address_city?: string;
  address_municipality?: string;
  companyform_code?: string;
  companyform_description?: string;
  companystatus_code?: string;
  industry_primary_text?: string;
  industry_primary_code?: string;
  industry_secondary_text?: string;
  industry_secondary_code?: string;
  employment_amount?: string;
  employment_interval_low?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_www?: string;
  status_bankrupt?: string;
  capital_capital?: string;
  capital_ipo?: string;
}

export async function searchCompanies(params: SearchCompanyParams): Promise<CvrCompany[]> {
  const cleanParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== "all") {
      // CVR API uses dot notation (e.g. life.name, industry.primary.code)
      const dotKey = key.replace(/_/g, ".");
      cleanParams[dotKey] = value;
    }
  }
  const data = await cvrFetch<{ results: CvrCompany[] }>("/v2/dk/search/company", cleanParams);
  return data.results ?? [];
}

export async function suggestCompanies(name: string): Promise<CvrCompany[]> {
  if (!name || name.length < 2) return [];
  return cvrFetch<CvrCompany[]>(`/v2/dk/suggestions/company/${encodeURIComponent(name)}`);
}
