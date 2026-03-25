export type CrmProvider = "hubspot" | "salesforce" | "pipedrive";

export interface CrmCompanyPayload {
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
}

export interface CrmClient {
  createCompany(data: CrmCompanyPayload): Promise<{ id: string }>;
  updateCompany(id: string, data: CrmCompanyPayload): Promise<void>;
  findCompanyByVat(vat: string): Promise<{ id: string } | null>;
}

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
    scopes: "crm.objects.companies.write crm.objects.companies.read",
    clientIdEnv: "HUBSPOT_CLIENT_ID",
    clientSecretEnv: "HUBSPOT_CLIENT_SECRET",
  },
  salesforce: {
    name: "Salesforce",
    icon: "cloud",
    color: "#00A1E0",
    authUrl: "https://login.salesforce.com/services/oauth2/authorize",
    tokenUrl: "https://login.salesforce.com/services/oauth2/token",
    scopes: "api refresh_token",
    clientIdEnv: "SALESFORCE_CLIENT_ID",
    clientSecretEnv: "SALESFORCE_CLIENT_SECRET",
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
