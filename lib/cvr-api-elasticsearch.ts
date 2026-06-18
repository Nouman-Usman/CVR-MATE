import "server-only";

const ES_BASE_URL = "https://distribution.virk.dk";
const ES_ENDPOINT = "/cvr-permanent/virksomhed/_search";

function getAuthHeader(): string {
  const username = process.env.CVR_USERNAME;
  const password = process.env.CVR_PASSWORD;
  if (!username || !password) {
    throw new Error("CVR_USERNAME or CVR_PASSWORD not configured");
  }
  const credentials = `${username}:${password}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

interface EsResponse<T> {
  took: number;
  timed_out: boolean;
  _shards: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  hits: {
    total: { value: number; relation: string } | number;
    max_score: number | null;
    hits: Array<{
      _index: string;
      _id: string;
      _score: number;
      _source: T;
    }>;
  };
}

export interface EsCompanyData {
  Virksomhed?: {
    cvrNummer?: number;
    virksomhedMetadata?: {
      nyesteNavn?: { navn?: string };
      nyesteBeliggenhedsadresse?: {
        vejnavn?: string;
        husnummerFra?: number;
        postnummer?: number;
        bynavn?: string;
        kommune?: { kommuneNavn?: string };
      };
      nyestePrimaryNace?: {
        naceKode?: string;
        naceText?: string;
      };
      nyesteBibranche1?: {
        naceKode?: string;
        naceText?: string;
      };
    };
    virksomhedStatus?: { statuskode?: number; status?: string };
    livsforloeb?: {
      periode?: { gyldigFra?: string; gyldigTil?: string };
    }[];
    navne?: Array<{
      navn?: string;
      periode?: { gyldigFra?: string; gyldigTil?: string };
    }>;
    beliggenhedsadresse?: Array<{
      vejnavn?: string;
      husnummerFra?: number;
      postnummer?: number;
      bynavn?: string;
      kommune?: { kommuneNavn?: string };
      periode?: { gyldigFra?: string; gyldigTil?: string };
    }>;
    telefonNummer?: Array<{ kontaktoplysning?: string }>;
    elektroniskPost?: Array<{ kontaktoplysning?: string }>;
    hjemmeside?: Array<{ kontaktoplysning?: string }>;
    companyForm?: {
      formCode?: number;
      formDescription?: string;
    };
    aarsbeskaeftigelse?: Array<{
      aar?: number;
      intervalKodeAntalAnsatte?: string;
    }>;
  };
}

export interface ParsedCompany {
  vat: number;
  name: string;
  city: string;
  industry: string;
  industryCode: string;
  status: string;
  founded: string;
  employees: string;
  form: string;
  isDissolved: boolean;
}

async function esSearch(query: unknown, from: number = 0, size: number = 20): Promise<EsResponse<EsCompanyData>> {
  const body = JSON.stringify({
    query,
    from,
    size,
    _source: true,
  });

  const url = `${ES_BASE_URL}${ES_ENDPOINT}`;
  console.log(`[ES Search] URL: ${url}`);
  console.log(`[ES Search] Query: ${body.slice(0, 200)}...`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuthHeader(),
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      console.error(`[ES Search] HTTP ${res.status}: ${text.slice(0, 500)}`);
      throw new Error("Upstream search failed");
    }

    const data = await res.json();
    console.log(`[ES Search] Got ${data.hits?.hits?.length || 0} results (total: ${typeof data.hits.total === "number" ? data.hits.total : data.hits.total?.value})`);
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ES Search] Fetch error: ${msg}`);
    console.error(`[ES Search] Endpoint: ${url}`);
    console.error(`[ES Search] Auth header present: ${!!process.env.CVR_USERNAME && !!process.env.CVR_PASSWORD}`);
    throw err;
  }
}

function parseCompany(data: EsCompanyData): ParsedCompany | null {
  const vir = data.Virksomhed;
  if (!vir) return null;

  const cvr = vir.cvrNummer;
  if (!cvr) return null;

  const meta = vir.virksomhedMetadata;
  const name = meta?.nyesteNavn?.navn || "";
  const address = meta?.nyesteBeliggenhedsadresse;
  const city = address?.bynavn || "";
  const industry = meta?.nyestePrimaryNace?.naceText || "";
  const industryCode = meta?.nyestePrimaryNace?.naceKode || "";
  const status = vir.virksomhedStatus?.status || "";

  // Founded date from earliest entry in livsforloeb
  let founded = "";
  if (vir.livsforloeb && vir.livsforloeb.length > 0) {
    const earliest = [...vir.livsforloeb].sort(
      (a, b) => (a.periode?.gyldigFra || "").localeCompare(b.periode?.gyldigFra || "")
    )[0];
    founded = earliest.periode?.gyldigFra || "";
  }

  // Check if dissolved
  const isDissolved = !!vir.livsforloeb?.some((l) => l.periode?.gyldigTil);

  // Employee count from latest year
  let employees = "–";
  if (vir.aarsbeskaeftigelse && vir.aarsbeskaeftigelse.length > 0) {
    const latest = vir.aarsbeskaeftigelse[vir.aarsbeskaeftigelse.length - 1];
    const interval = latest.intervalKodeAntalAnsatte;
    employees = interval || "–";
  }

  const form = vir.companyForm?.formDescription || "";

  return {
    vat: cvr,
    name,
    city,
    industry,
    industryCode,
    status,
    founded,
    employees,
    form,
    isDissolved,
  };
}

// Build Elasticsearch query from search filters
function buildEsQuery(filters: Record<string, string>): unknown {
  const must: unknown[] = [];

  const name = filters.life_name;
  if (name) {
    // Try match query first (simpler, better for text). Fallback: query_string with wildcards
    must.push({
      match: {
        "Virksomhed.virksomhedMetadata.nyesteNavn.navn": {
          query: name,
          operator: "and",
        },
      },
    });
  }

  const zipcode = filters.address_zipcode;
  if (zipcode) {
    must.push({
      term: {
        "Virksomhed.virksomhedMetadata.nyesteBeliggenhedsadresse.postnummer": parseInt(zipcode),
      },
    });
  }

  const industryCode = filters.industry_primary_code;
  if (industryCode) {
    must.push({
      term: {
        "Virksomhed.virksomhedMetadata.nyestePrimaryNace.naceKode": industryCode,
      },
    });
  }

  const companyformCode = filters.companyform_code;
  if (companyformCode) {
    must.push({
      term: {
        "Virksomhed.companyForm.formCode": parseInt(companyformCode),
      },
    });
  }

  const statusCode = filters.company_status_code;
  if (statusCode) {
    must.push({
      term: {
        "Virksomhed.virksomhedStatus.statuskode": parseInt(statusCode),
      },
    });
  }

  // Exclude marketing opt-out if specified
  const skipMarketingOptOut = filters.life_adprotected === "true";
  if (skipMarketingOptOut) {
    must.push({
      bool: {
        must_not: [
          {
            term: {
              "Virksomhed.livsforloeb.adprotected": true,
            },
          },
        ],
      },
    });
  }

  if (must.length === 0) {
    return { match_all: {} };
  }

  return {
    bool: {
      must,
    },
  };
}

export async function searchCompaniesElasticsearch(
  filters: Record<string, string>,
  page: number = 1,
  pageSize: number = 20
): Promise<{ companies: ParsedCompany[]; total: number; hasMore: boolean }> {
  // Defense-in-depth: clamp values at client level
  const validatedPage = Math.max(1, Math.min(page, 1000));
  const validatedPageSize = Math.max(1, Math.min(pageSize, 100));
  const from = (validatedPage - 1) * validatedPageSize;
  const query = buildEsQuery(filters);

  const response = await esSearch(query, from, validatedPageSize);

  const totalHits = typeof response.hits.total === "number"
    ? response.hits.total
    : response.hits.total.value;

  const companies = response.hits.hits
    .map((hit) => parseCompany(hit._source))
    .filter((c) => c !== null) as ParsedCompany[];

  const hasMore = from + pageSize < totalHits;

  return {
    companies,
    total: totalHits,
    hasMore,
  };
}
