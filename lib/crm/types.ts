export type CrmProvider = "hubspot" | "leadconnector" | "pipedrive";

// ─── Payloads ──────────────────────────────────────────────────────────────

export interface CrmCompanyPayload {
  // Core fields
  name: string;
  vat: string;
  address?: string | null;
  city?: string | null;
  zipcode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  industry?: string | null;
  employees?: number | null;
  founded?: string | null;
  // Extended company fields
  municipality?: string | null;
  companyType?: string | null;       // "ApS", "A/S", "IVS"
  companyStatus?: string | null;     // "ACTIVE", "DISSOLVED"
  capital?: number | null;           // registered capital in DKK
  industryCode?: string | null;      // NACE/DB07 code
  // Financial metrics (latest snapshot)
  revenue?: number | null;
  profit?: number | null;
  equity?: number | null;
  // User metadata
  tags?: string[] | null;            // from savedCompany.tags
}

export interface CrmContactPayload {
  firstName: string;
  lastName: string;
  fullName: string;
  jobTitle?: string | null;          // from role.title or profession
  roles?: string | null;             // formatted: "Director, Owner (35%)"
  participantNumber?: string | null; // CVR participant ID for dedup
  companyVat?: string | null;        // for context
}

export interface CrmNotePayload {
  title: string;
  body: string; // HTML for HubSpot/Pipedrive/LeadConnector
}

// ─── Client Interface ──────────────────────────────────────────────────────

export interface CrmClient {
  // Company operations (existing)
  createCompany(data: CrmCompanyPayload): Promise<{ id: string }>;
  updateCompany(id: string, data: CrmCompanyPayload): Promise<void>;
  findCompanyByVat(vat: string): Promise<{ id: string } | null>;

  // Contact operations
  createContact(data: CrmContactPayload, companyId: string): Promise<{ id: string }>;
  updateContact(id: string, data: CrmContactPayload): Promise<void>;
  findContactByName(firstName: string, lastName: string, companyId: string): Promise<{ id: string } | null>;

  // Notes (attached to a company)
  createNote(companyId: string, note: CrmNotePayload): Promise<{ id: string }>;

  // Custom property setup (idempotent, called once per push session)
  ensureCustomProperties(): Promise<void>;
}

// ─── Provider Config ───────────────────────────────────────────────────────

export interface CrmProviderConfig {
  name: string;
  icon: string;
  color: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string;
  clientIdEnv: string;
  clientSecretEnv: string;
}

export const CRM_PROVIDERS: Record<CrmProvider, CrmProviderConfig> = {
  hubspot: {
    name: "HubSpot",
    icon: "hub",
    color: "#FF7A59",
    authUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v1/token",
    scopes: "crm.objects.companies.write crm.objects.companies.read crm.objects.contacts.write crm.objects.contacts.read",
    clientIdEnv: "HUBSPOT_CLIENT_ID",
    clientSecretEnv: "HUBSPOT_CLIENT_SECRET",
  },
  leadconnector: {
    name: "GoHighLevel",
    icon: "rocket_launch",
    color: "#FF6B35",
    authUrl: "https://marketplace.gohighlevel.com/oauth/chooselocation",
    tokenUrl: "https://services.leadconnectorhq.com/oauth/token",
    scopes: "contacts.write contacts.readonly businesses.write businesses.readonly locations/customFields.write locations/customFields.readonly locations.readonly",
    clientIdEnv: "LEADCONNECTOR_CLIENT_ID",
    clientSecretEnv: "LEADCONNECTOR_CLIENT_SECRET",
  },
  pipedrive: {
    name: "Pipedrive",
    icon: "filter_alt",
    color: "#017737",
    authUrl: "https://oauth.pipedrive.com/oauth/authorize",
    tokenUrl: "https://oauth.pipedrive.com/oauth/token",
    scopes: "",
    clientIdEnv: "PIPEDRIVE_CLIENT_ID",
    clientSecretEnv: "PIPEDRIVE_CLIENT_SECRET",
  },
};
