import type { CrmClient, CrmCompanyPayload, CrmContactPayload, CrmNotePayload } from "../types";
import { CrmApiError, classifyCrmError } from "../errors";
import { withRetry } from "../retry";

const BASE = "https://api.hubapi.com/crm/v3/objects";
const PROPERTIES_API = "https://api.hubapi.com/crm/v3/properties";

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
  return undefined;
}

// ─── Custom Property Definitions ───────────────────────────────────────────

interface PropertyDef {
  objectType: "companies" | "contacts";
  name: string;
  label: string;
  type: string;
  fieldType: string;
  groupName: string;
  description: string;
}

const CUSTOM_PROPERTIES: PropertyDef[] = [
  // Company properties
  { objectType: "companies", name: "cvr_number", label: "CVR Number", type: "string", fieldType: "text", groupName: "companyinformation", description: "Danish CVR business registration number (synced from CVR-MATE)" },
  { objectType: "companies", name: "cvr_capital", label: "Registered Capital (DKK)", type: "number", fieldType: "number", groupName: "companyinformation", description: "Registered share capital in DKK" },
  { objectType: "companies", name: "cvr_industry_code", label: "Industry Code", type: "string", fieldType: "text", groupName: "companyinformation", description: "NACE/DB07 industry code" },
  { objectType: "companies", name: "cvr_status", label: "Company Status", type: "string", fieldType: "text", groupName: "companyinformation", description: "CVR registration status (e.g. ACTIVE, DISSOLVED)" },
  { objectType: "companies", name: "cvr_tags", label: "CVR-MATE Tags", type: "string", fieldType: "text", groupName: "companyinformation", description: "Tags from CVR-MATE (semicolon-separated)" },
  { objectType: "companies", name: "cvr_lead_grade", label: "CVR-MATE Lead Grade", type: "string", fieldType: "text", groupName: "companyinformation", description: "AI-generated lead score (A/B/C/D)" },
  { objectType: "companies", name: "cvr_financial_health", label: "CVR-MATE Financial Health", type: "string", fieldType: "text", groupName: "companyinformation", description: "AI-generated financial health assessment" },
  // Contact properties
  { objectType: "contacts", name: "cvr_participant_number", label: "CVR Participant Number", type: "string", fieldType: "text", groupName: "contactinformation", description: "Danish CVR participant ID (synced from CVR-MATE)" },
  { objectType: "contacts", name: "cvr_roles", label: "CVR Roles", type: "string", fieldType: "text", groupName: "contactinformation", description: "Roles in company (e.g. Director, Owner 35%)" },
];

// ─── HubSpot Client ────────────────────────────────────────────────────────

export function createHubSpotClient(accessToken: string): CrmClient {
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  let propertiesVerified = false;

  // ─── Custom Properties ─────────────────────────────────────────────────

  async function ensureCustomProperties(): Promise<void> {
    if (propertiesVerified) return;

    for (const prop of CUSTOM_PROPERTIES) {
      try {
        const checkRes = await fetch(`${PROPERTIES_API}/${prop.objectType}/${prop.name}`, {
          headers: authHeaders,
        });

        if (checkRes.ok) continue;

        if (checkRes.status === 404) {
          const createRes = await fetch(`${PROPERTIES_API}/${prop.objectType}`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              name: prop.name,
              label: prop.label,
              type: prop.type,
              fieldType: prop.fieldType,
              groupName: prop.groupName,
              description: prop.description,
            }),
          });
          if (!createRes.ok) {
            const errText = await createRes.text();
            if (!errText.includes("already exists")) {
              console.warn(`[HubSpot] Could not create property ${prop.name}: ${errText}`);
            }
          }
        }
      } catch (err) {
        console.warn(`[HubSpot] Property check failed for ${prop.name}:`, err);
      }
    }

    propertiesVerified = true;
  }

  // ─── Company Payload Mapping ───────────────────────────────────────────

  function mapCompanyPayload(data: CrmCompanyPayload) {
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
      // Extended fields
      annualrevenue: data.revenue != null ? String(data.revenue) : undefined,
      cvr_capital: data.capital != null ? String(data.capital) : undefined,
      cvr_industry_code: data.industryCode || undefined,
      cvr_status: data.companyStatus || undefined,
      cvr_tags: data.tags?.join("; ") || undefined,
    };

    const cleaned = Object.fromEntries(
      Object.entries(properties).filter(([, v]) => v !== undefined)
    );
    return { properties: cleaned };
  }

  // ─── Contact Payload Mapping ───────────────────────────────────────────

  function mapContactPayload(data: CrmContactPayload) {
    const properties: Record<string, string | undefined> = {
      firstname: data.firstName || undefined,
      lastname: data.lastName,
      jobtitle: data.jobTitle || undefined,
      cvr_participant_number: data.participantNumber || undefined,
      cvr_roles: data.roles || undefined,
    };

    const cleaned = Object.fromEntries(
      Object.entries(properties).filter(([, v]) => v !== undefined)
    );
    return { properties: cleaned };
  }

  // ─── Error Recovery ────────────────────────────────────────────────────

  function extractBadPropertyName(
    body: string,
    sentProperties: Record<string, string | undefined>,
  ): string | null {
    try {
      const parsed = JSON.parse(body);
      const errors: { message?: string; code?: string; context?: { propertyName?: string[] } }[] = parsed.errors ?? [];

      for (const err of errors) {
        if (err.code === "INVALID_OPTION" && err.context?.propertyName?.[0]) {
          const prop = err.context.propertyName[0];
          if (prop in sentProperties) return prop;
        }
        if (err.message) {
          const match = err.message.match(/[Pp]roperty\s+"(\w+)"\s+does not exist/);
          if (match && match[1] in sentProperties) return match[1];
        }
      }

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

  async function sendWithFallback(
    url: string,
    method: string,
    payload: { properties: Record<string, string | undefined> },
  ): Promise<Response> {
    let res = await fetch(url, {
      method,
      headers: authHeaders,
      body: JSON.stringify(payload),
    });

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
        throw classifyFromBody(res.status, body, method === "POST" ? "create" : "update");
      }
    }

    return res;
  }

  // ─── CrmClient Implementation ─────────────────────────────────────────

  return {
    ensureCustomProperties,

    // ── Company ────────────────────────────────────────────────────────

    async createCompany(data) {
      await ensureCustomProperties();
      return withRetry(async () => {
        const payload = mapCompanyPayload(data);
        const res = await sendWithFallback(`${BASE}/companies`, "POST", payload);
        if (!res.ok) throw await classifyCrmError(res, "hubspot", "createCompany");
        const result = await res.json();
        return { id: result.id };
      });
    },

    async updateCompany(id, data) {
      await ensureCustomProperties();
      return withRetry(async () => {
        const payload = mapCompanyPayload(data);
        const res = await sendWithFallback(`${BASE}/companies/${id}`, "PATCH", payload);
        if (!res.ok) throw await classifyCrmError(res, "hubspot", "updateCompany");
      });
    },

    async findCompanyByVat(vat) {
      return withRetry(async () => {
        const res = await fetch(`${BASE}/companies/search`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            filterGroups: [
              { filters: [{ propertyName: "cvr_number", operator: "EQ", value: vat }] },
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

    // ── Contacts ──────────────────────────────────────────────────────

    async createContact(data, companyId) {
      await ensureCustomProperties();
      return withRetry(async () => {
        const payload = {
          ...mapContactPayload(data),
          associations: [
            {
              to: { id: companyId },
              types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 279 }],
            },
          ],
        };
        const res = await fetch(`${BASE}/contacts`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw await classifyCrmError(res, "hubspot", "createContact");
        const result = await res.json();
        return { id: result.id };
      });
    },

    async updateContact(id, data) {
      return withRetry(async () => {
        const payload = mapContactPayload(data);
        const res = await fetch(`${BASE}/contacts/${id}`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw await classifyCrmError(res, "hubspot", "updateContact");
      });
    },

    async findContactByName(firstName, lastName, companyId) {
      return withRetry(async () => {
        const filters: { propertyName: string; operator: string; value: string }[] = [
          { propertyName: "lastname", operator: "EQ", value: lastName },
        ];
        if (firstName) {
          filters.push({ propertyName: "firstname", operator: "EQ", value: firstName });
        }

        const res = await fetch(`${BASE}/contacts/search`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            filterGroups: [{ filters }],
            properties: ["firstname", "lastname"],
            limit: 10,
          }),
        });
        if (!res.ok) return null;
        const result = await res.json();
        if (result.total > 0) return { id: result.results[0].id };
        return null;
      });
    },

    // ── Notes ─────────────────────────────────────────────────────────

    async createNote(companyId, note) {
      return withRetry(async () => {
        // Create note first, then associate separately (more reliable than inline associations)
        const createRes = await fetch(`${BASE}/notes`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            properties: {
              hs_note_body: note.body,
              hs_timestamp: new Date().toISOString(),
            },
          }),
        });
        if (!createRes.ok) throw await classifyCrmError(createRes, "hubspot", "createNote");
        const result = await createRes.json();
        const noteId = result.id;

        // Associate note → company using v4 associations API
        try {
          const assocRes = await fetch(
            `https://api.hubapi.com/crm/v4/objects/notes/${noteId}/associations/companies/${companyId}`,
            {
              method: "PUT",
              headers: authHeaders,
              body: JSON.stringify([
                { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 190 },
              ]),
            }
          );
          if (!assocRes.ok) {
            console.warn(`[HubSpot] Note association failed: ${await assocRes.text()}`);
          }
        } catch (err) {
          console.warn("[HubSpot] Note association error:", err);
        }

        return { id: noteId };
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
