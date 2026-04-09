import type { CrmClient, CrmCompanyPayload } from "../types";
import { CrmApiError, classifyCrmError } from "../errors";
import { withRetry } from "../retry";

const BASE = "https://api.hubapi.com/crm/v3/objects/companies";
const PROPERTIES_API = "https://api.hubapi.com/crm/v3/properties/companies";

/**
 * Map Danish CVR industry names (and common English ones) to HubSpot's enum values.
 * HubSpot requires exact enum strings. This is a best-effort keyword mapping.
 */
const INDUSTRY_KEYWORDS: [RegExp, string][] = [
  [/software|it-|programmering|edb|computer.*program/i, "COMPUTER_SOFTWARE"],
  [/internet|web|online|digital/i, "INTERNET"],
  [/computer.*spil|game/i, "COMPUTER_GAMES"],
  [/computer.*hardware/i, "COMPUTER_HARDWARE"],
  [/computer.*netv|network.*security/i, "COMPUTER_NETWORK_SECURITY"],
  [/computer.*net/i, "COMPUTER_NETWORKING"],
  [/informationsteknologi|information.*tech/i, "INFORMATION_TECHNOLOGY_AND_SERVICES"],
  [/telekommunikation|telecom/i, "TELECOMMUNICATIONS"],
  [/bank|pengevæsen/i, "BANKING"],
  [/finans|financial|kapital/i, "FINANCIAL_SERVICES"],
  [/forsikring|insurance/i, "INSURANCE"],
  [/invest|kapitalforvaltning/i, "INVESTMENT_MANAGEMENT"],
  [/ejendom|real.*estate/i, "REAL_ESTATE"],
  [/bygge|konstruktion|construction|murer|tømrer/i, "CONSTRUCTION"],
  [/arkitekt|architecture/i, "ARCHITECTURE_PLANNING"],
  [/ingeniør|engineering|maskin/i, "MECHANICAL_OR_INDUSTRIAL_ENGINEERING"],
  [/civil.*ingeniør|civil.*eng/i, "CIVIL_ENGINEERING"],
  [/elektrisk|elektron|electric/i, "ELECTRICAL_ELECTRONIC_MANUFACTURING"],
  [/automat|industrial.*auto/i, "INDUSTRIAL_AUTOMATION"],
  [/detail|retail|butik/i, "RETAIL"],
  [/engros|wholesale/i, "WHOLESALE"],
  [/supermarked/i, "SUPERMARKETS"],
  [/restaurant|bespisning|cafe|kafe/i, "RESTAURANTS"],
  [/hotel|hospitality|overnatning/i, "HOSPITALITY"],
  [/rejse|turisme|travel|tourism/i, "LEISURE_TRAVEL_TOURISM"],
  [/transport|logistik|fragt|shipping/i, "TRANSPORTATION_TRUCKING_RAILROAD"],
  [/lager|warehousing/i, "WAREHOUSING"],
  [/fly|luft|aviation|aerospace/i, "AVIATION_AEROSPACE"],
  [/skib|shipbuilding|maritim/i, "SHIPBUILDING"],
  [/bil|automotive|auto.*handel/i, "AUTOMOTIVE"],
  [/sundhed|health|wellness|fitness/i, "HEALTH_WELLNESS_AND_FITNESS"],
  [/hospital|sygehus|klinik/i, "HOSPITAL_HEALTH_CARE"],
  [/læge|medical.*practice/i, "MEDICAL_PRACTICE"],
  [/medicinsk.*udstyr|medical.*device/i, "MEDICAL_DEVICES"],
  [/farmaci|pharma/i, "PHARMACEUTICALS"],
  [/biotek|biotech/i, "BIOTECHNOLOGY"],
  [/psyk|mental.*health/i, "MENTAL_HEALTH_CARE"],
  [/veterinær|dyrlæge|veterinary/i, "VETERINARY"],
  [/kosmetik|cosmetic/i, "COSMETICS"],
  [/mejer|dairy/i, "DAIRY"],
  [/fødevare|food.*prod/i, "FOOD_PRODUCTION"],
  [/drikkevare|food.*bev/i, "FOOD_BEVERAGES"],
  [/landbrug|farm/i, "FARMING"],
  [/fiskeri|fish/i, "FISHERY"],
  [/uddannelse|education|skole|school/i, "EDUCATION_MANAGEMENT"],
  [/højere.*uddannelse|higher.*edu|universitet/i, "HIGHER_EDUCATION"],
  [/e.learning|online.*kursus/i, "E_LEARNING"],
  [/forskning|research/i, "RESEARCH"],
  [/rådgivning|consulting|konsulent/i, "MANAGEMENT_CONSULTING"],
  [/human.*resource|hr\b|personale/i, "HUMAN_RESOURCES"],
  [/rekruttering|staffing|recruiting/i, "STAFFING_AND_RECRUITING"],
  [/revision|regnskab|account/i, "ACCOUNTING"],
  [/advokat|law|jura|juridisk/i, "LAW_PRACTICE"],
  [/marketing|reklame|advert/i, "MARKETING_AND_ADVERTISING"],
  [/design|grafisk/i, "DESIGN"],
  [/medie|media.*prod/i, "MEDIA_PRODUCTION"],
  [/forlag|publishing|udgiv/i, "PUBLISHING"],
  [/tryk|print/i, "PRINTING"],
  [/film|motion.*picture/i, "MOTION_PICTURES_AND_FILM"],
  [/musik|music/i, "MUSIC"],
  [/kunst|art|galleri/i, "FINE_ART"],
  [/foto|photography/i, "PHOTOGRAPHY"],
  [/sport|idræt/i, "SPORTS"],
  [/underholdning|entertainment/i, "ENTERTAINMENT"],
  [/olie|energi|oil|energy/i, "OIL_ENERGY"],
  [/vedvarende|renewable|miljø.*tech/i, "RENEWABLES_ENVIRONMENT"],
  [/miljø|environment/i, "ENVIRONMENTAL_SERVICES"],
  [/kemi|chemical/i, "CHEMICALS"],
  [/halvleder|semiconductor/i, "SEMICONDUCTORS"],
  [/plast|plastic/i, "PLASTICS"],
  [/metal|mining/i, "MINING_METALS"],
  [/maskiner|machinery/i, "MACHINERY"],
  [/møbel|furniture/i, "FURNITURE"],
  [/tekstil|textile|tøj|apparel|fashion/i, "APPAREL_FASHION"],
  [/smykke|luxury|luksus/i, "LUXURY_GOODS_JEWELRY"],
  [/sikkerhed|security|investigation/i, "SECURITY_AND_INVESTIGATIONS"],
  [/forsvar|defense|militær/i, "DEFENSE_SPACE"],
  [/non.*profit|velgøren|nonprofit|forening/i, "NON_PROFIT_ORGANIZATION_MANAGEMENT"],
  [/offentlig.*admin|government|kommune|stat/i, "GOVERNMENT_ADMINISTRATION"],
  [/import|export|handel/i, "IMPORT_AND_EXPORT"],
  [/trådløs|wireless/i, "WIRELESS"],
  [/nano/i, "NANOTECHNOLOGY"],
  [/animation/i, "ANIMATION"],
];

function mapIndustryToHubSpot(industry: string | null | undefined): string | undefined {
  if (!industry) return undefined;

  for (const [pattern, hubspotValue] of INDUSTRY_KEYWORDS) {
    if (pattern.test(industry)) return hubspotValue;
  }

  // No match — don't send an invalid value
  return undefined;
}

export function createHubSpotClient(accessToken: string): CrmClient {
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  let cvrPropertyVerified = false;

  async function ensureCvrProperty(): Promise<void> {
    if (cvrPropertyVerified) return;

    try {
      const checkRes = await fetch(`${PROPERTIES_API}/cvr_number`, {
        headers: authHeaders,
      });

      if (checkRes.ok) {
        cvrPropertyVerified = true;
        return;
      }

      if (checkRes.status === 404) {
        const createRes = await fetch(PROPERTIES_API, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            name: "cvr_number",
            label: "CVR Number",
            type: "string",
            fieldType: "text",
            groupName: "companyinformation",
            description: "Danish CVR business registration number (synced from CVR-MATE)",
          }),
        });

        if (!createRes.ok) {
          const errText = await createRes.text();
          if (!errText.includes("already exists")) {
            console.warn(`[HubSpot] Could not create cvr_number property: ${errText}`);
          }
        }
      }
    } catch (err) {
      console.warn("[HubSpot] cvr_number property check failed:", err);
    }

    cvrPropertyVerified = true;
  }

  function mapPayload(data: CrmCompanyPayload) {
    const properties: Record<string, string | undefined> = {
      name: data.name,
      domain: data.website?.replace(/^https?:\/\//, "") || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      city: data.city || undefined,
      zip: data.zipcode || undefined,
      industry: mapIndustryToHubSpot(data.industry),
      numberofemployees: data.employees != null ? String(data.employees) : undefined,
      cvr_number: data.vat,
    };

    const cleaned = Object.fromEntries(
      Object.entries(properties).filter(([, v]) => v !== undefined)
    );

    return { properties: cleaned };
  }

  /**
   * Parse a HubSpot 400 error to find which property caused the failure.
   * Handles both "does not exist" and "INVALID_OPTION" errors.
   * Returns the property name only if it matches a property we sent.
   */
  function extractBadPropertyName(
    body: string,
    sentProperties: Record<string, string | undefined>,
  ): string | null {
    try {
      const parsed = JSON.parse(body);
      const errors: { message?: string; code?: string; context?: { propertyName?: string[] } }[] = parsed.errors ?? [];

      for (const err of errors) {
        // INVALID_OPTION errors have context.propertyName
        if (err.code === "INVALID_OPTION" && err.context?.propertyName?.[0]) {
          const prop = err.context.propertyName[0];
          if (prop in sentProperties) return prop;
        }

        // "Property X does not exist" errors
        if (err.message) {
          const match = err.message.match(/[Pp]roperty\s+"(\w+)"\s+does not exist/);
          if (match && match[1] in sentProperties) return match[1];
        }
      }

      // Fallback: check top-level message
      if (parsed.message) {
        const match = parsed.message.match(/[Pp]roperty\s+"(\w+)"\s+does not exist/);
        if (match && match[1] in sentProperties) return match[1];
      }
    } catch {
      const match = body.match(/[Pp]roperty\s+"(\w+)"\s+does not exist/);
      if (match && match[1] in sentProperties) return match[1];
    }

    return null;
  }

  /**
   * Send a request, and if HubSpot rejects a property (missing or invalid value),
   * strip it and retry once. This prevents one bad field from blocking the entire sync.
   */
  async function sendWithFallback(
    url: string,
    method: string,
    data: CrmCompanyPayload,
  ): Promise<Response> {
    const payload = mapPayload(data);
    let res = await fetch(url, {
      method,
      headers: authHeaders,
      body: JSON.stringify(payload),
    });

    // If 400, try to recover by stripping the bad property
    if (res.status === 400) {
      const body = await res.text();
      const badProp = extractBadPropertyName(body, payload.properties);

      if (badProp) {
        console.warn(`[HubSpot] Property "${badProp}" rejected — retrying without it`);
        delete payload.properties[badProp];

        res = await fetch(url, {
          method,
          headers: authHeaders,
          body: JSON.stringify(payload),
        });
      } else {
        throw classifyFromBody(res.status, body, method === "POST" ? "createCompany" : "updateCompany");
      }
    }

    return res;
  }

  return {
    async createCompany(data) {
      await ensureCvrProperty();

      return withRetry(async () => {
        const res = await sendWithFallback(BASE, "POST", data);
        if (!res.ok) throw await classifyCrmError(res, "hubspot", "createCompany");
        const result = await res.json();
        return { id: result.id };
      });
    },

    async updateCompany(id, data) {
      await ensureCvrProperty();

      return withRetry(async () => {
        const res = await sendWithFallback(`${BASE}/${id}`, "PATCH", data);
        if (!res.ok) throw await classifyCrmError(res, "hubspot", "updateCompany");
      });
    },

    async findCompanyByVat(vat) {
      return withRetry(async () => {
        const res = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  { propertyName: "cvr_number", operator: "EQ", value: vat },
                ],
              },
            ],
            properties: ["name", "cvr_number"],
            limit: 1,
          }),
        });
        if (!res.ok) return null;
        const result = await res.json();
        if (result.total > 0) return { id: result.results[0].id };
        return null;
      });
    },
  };
}

function classifyFromBody(
  status: number,
  body: string,
  operation: string,
): CrmApiError {
  const msg = `hubspot ${operation} failed (${status}): ${body.slice(0, 300)}`;
  const retryable = status >= 500;
  return new CrmApiError(msg, status, "hubspot", retryable);
}
