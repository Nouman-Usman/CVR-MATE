import type { CrmClient, CrmProvider } from "./types";
import { getValidToken } from "./token-manager";
import { createHubSpotClient } from "./providers/hubspot";
import { createSalesforceClient } from "./providers/salesforce";
import { createPipedriveClient } from "./providers/pipedrive";

export async function getCrmClient(connectionId: string, provider: CrmProvider): Promise<CrmClient> {
  const tokens = await getValidToken(connectionId);

  switch (provider) {
    case "hubspot":
      return createHubSpotClient(tokens.accessToken);
    case "salesforce":
      if (!tokens.instanceUrl) throw new Error("Salesforce connection missing instance URL");
      return createSalesforceClient(tokens.accessToken, tokens.instanceUrl);
    case "pipedrive":
      return createPipedriveClient(tokens.accessToken);
    default:
      throw new Error(`Unknown CRM provider: ${provider}`);
  }
}

export { type CrmClient, type CrmProvider, type CrmCompanyPayload } from "./types";
export { CRM_PROVIDERS } from "./types";
