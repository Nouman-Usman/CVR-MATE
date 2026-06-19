import "server-only";

// ⚠️  SECURITY NOTE: API provider only supports HTTP (not HTTPS).
// Credentials are sent over plaintext. This is a risk with the upstream provider.
// Recommend: contact provider to add HTTPS support, or use VPN/tunnel.
const ES_BASE_URL = "http://distribution.virk.dk";
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
  Vrvirksomhed?: {
    cvrNummer?: number;
    reklamebeskyttet?: boolean;
    virksomhedMetadata?: {
      nyesteNavn?: { navn?: string };
      nyesteBeliggenhedsadresse?: {
        vejnavn?: string;
        husnummerFra?: number;
        postnummer?: number;
        postdistrikt?: string;
        bynavn?: string;
        kommune?: { kommuneKode?: number; kommuneNavn?: string };
      };
      nyesteHovedbranche?: { branchekode?: string; branchetekst?: string };
      nyesteBibranche1?: { branchekode?: string; branchetekst?: string };
      nyesteVirksomhedsform?: {
        virksomhedsformkode?: number;
        kortBeskrivelse?: string;
        langBeskrivelse?: string;
      };
      sammensatStatus?: string;
      stiftelsesDato?: string;
    };
    livsforloeb?: Array<{
      periode?: { gyldigFra?: string; gyldigTil?: string };
    }>;
    navne?: Array<{
      navn?: string;
      periode?: { gyldigFra?: string; gyldigTil?: string };
    }>;
    telefonNummer?: Array<{ kontaktoplysning?: string }>;
    elektroniskPost?: Array<{ kontaktoplysning?: string }>;
    hjemmeside?: Array<{ kontaktoplysning?: string }>;
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
  const vir = data.Vrvirksomhed;
  if (!vir) return null;

  const cvr = vir.cvrNummer;
  if (!cvr) return null;

  const meta = vir.virksomhedMetadata;
  const name = meta?.nyesteNavn?.navn || "";
  const address = meta?.nyesteBeliggenhedsadresse;
  const city = address?.postdistrikt || address?.bynavn || "";
  const industry = meta?.nyesteHovedbranche?.branchetekst || "";
  const industryCode = meta?.nyesteHovedbranche?.branchekode || "";
  const status = meta?.sammensatStatus || "";
  const founded = meta?.stiftelsesDato || "";

  // Active statuses are NORMAL and AKTIV; anything else (OPHØRT, TVANGSOPLØST, UNDER KONKURS, etc.) = dissolved
  const activeStatuses = ["NORMAL", "AKTIV"];
  const isDissolved = status ? !activeStatuses.includes(status.toUpperCase()) : false;

  // Employee count from most recent yearly record
  let employees = "–";
  if (vir.aarsbeskaeftigelse && vir.aarsbeskaeftigelse.length > 0) {
    const latest = [...vir.aarsbeskaeftigelse].sort((a, b) => (b.aar ?? 0) - (a.aar ?? 0))[0];
    employees = latest.intervalKodeAntalAnsatte || "–";
  }

  const form = meta?.nyesteVirksomhedsform?.kortBeskrivelse || "";

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
    must.push({
      multi_match: {
        query: name,
        fields: [
          "Vrvirksomhed.virksomhedMetadata.nyesteNavn.navn",
          "Vrvirksomhed.navne.navn",
        ],
        operator: "or",
      },
    });
  }

  // Single zipcode (exact match)
  const zipcode = filters.address_zipcode;
  if (zipcode) {
    must.push({
      term: {
        "Vrvirksomhed.virksomhedMetadata.nyesteBeliggenhedsadresse.postnummer": parseInt(zipcode),
      },
    });
  }

  // Region → comma-separated zipcode list → ES terms query
  const zipcodeList = filters.zipcode_list;
  if (zipcodeList) {
    const zipcodes = zipcodeList.split(",").map((z) => parseInt(z.trim())).filter((n) => !isNaN(n));
    if (zipcodes.length > 0) {
      must.push({
        terms: {
          "Vrvirksomhed.virksomhedMetadata.nyesteBeliggenhedsadresse.postnummer": zipcodes,
        },
      });
    }
  }

  const city = filters.city;
  if (city) {
    // bynavn is consistently null in ES dataset; postdistrikt holds the city/district name
    must.push({
      match: {
        "Vrvirksomhed.virksomhedMetadata.nyesteBeliggenhedsadresse.postdistrikt": {
          query: city,
          operator: "and",
        },
      },
    });
  }

  const municipality = filters.municipality;
  if (municipality) {
    must.push({
      term: {
        "Vrvirksomhed.virksomhedMetadata.nyesteBeliggenhedsadresse.kommune.kommuneKode": parseInt(municipality),
      },
    });
  }

  const street = filters.street;
  if (street) {
    must.push({
      match: {
        "Vrvirksomhed.virksomhedMetadata.nyesteBeliggenhedsadresse.vejnavn": {
          query: street,
          operator: "and",
        },
      },
    });
  }

  const numberFrom = filters.number_from;
  if (numberFrom) {
    must.push({
      term: {
        "Vrvirksomhed.virksomhedMetadata.nyesteBeliggenhedsadresse.husnummerFra": parseInt(numberFrom),
      },
    });
  }

  const industryCode = filters.industry_primary_code;
  if (industryCode) {
    // 2-digit prefix matches all 6-digit NACE sub-codes (e.g. "47" → "470000", "471100", …)
    must.push({
      prefix: {
        "Vrvirksomhed.virksomhedMetadata.nyesteHovedbranche.branchekode": industryCode,
      },
    });
  }

  const industrySecondaryCode = filters.industry_secondary_code;
  if (industrySecondaryCode) {
    must.push({
      prefix: {
        "Vrvirksomhed.virksomhedMetadata.nyesteBibranche1.branchekode": industrySecondaryCode,
      },
    });
  }

  const companyformCode = filters.companyform_code;
  if (companyformCode) {
    must.push({
      term: {
        "Vrvirksomhed.virksomhedMetadata.nyesteVirksomhedsform.virksomhedsformkode": parseInt(companyformCode),
      },
    });
  }

  const statusCode = filters.company_status_code;
  if (statusCode) {
    // sammensatStatus is analyzed text (e.g. "NORMAL", "AKTIV", "OPHØRT") — match is case-insensitive
    must.push({
      match: {
        "Vrvirksomhed.virksomhedMetadata.sammensatStatus": statusCode,
      },
    });
  }

  // stiftelsesDato is a direct metadata field — no nested query needed
  const lifeStart = filters.life_start;
  if (lifeStart) {
    must.push({
      range: {
        "Vrvirksomhed.virksomhedMetadata.stiftelsesDato": { gte: lifeStart },
      },
    });
  }

  // Contact filters — all nested since they're arrays on the document
  const contactPhone = filters.contact_phone;
  if (contactPhone) {
    must.push({
      nested: {
        path: "Vrvirksomhed.telefonNummer",
        query: {
          term: { "Vrvirksomhed.telefonNummer.kontaktoplysning": contactPhone },
        },
      },
    });
  }

  const contactEmail = filters.contact_email;
  if (contactEmail) {
    must.push({
      nested: {
        path: "Vrvirksomhed.elektroniskPost",
        query: {
          term: { "Vrvirksomhed.elektroniskPost.kontaktoplysning": contactEmail.toLowerCase() },
        },
      },
    });
  }

  const contactWww = filters.contact_www;
  if (contactWww) {
    must.push({
      nested: {
        path: "Vrvirksomhed.hjemmeside",
        query: {
          match: {
            "Vrvirksomhed.hjemmeside.kontaktoplysning": {
              query: contactWww,
              operator: "and",
            },
          },
        },
      },
    });
  }

  // reklamebeskyttet = true means the company has opted out of marketing contact
  const skipMarketingOptOut = filters.life_adprotected === "true";
  if (skipMarketingOptOut) {
    must.push({
      bool: {
        must_not: [{ term: { "Vrvirksomhed.reklamebeskyttet": true } }],
      },
    });
  }

  if (must.length === 0) {
    return { match_all: {} };
  }

  return { bool: { must } };
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
