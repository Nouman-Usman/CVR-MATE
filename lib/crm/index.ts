import type { CrmClient, CrmProvider } from "./types";
import { getValidToken } from "./token-manager";
import { createHubSpotClient } from "./providers/hubspot";
import { createLeadConnectorClient } from "./providers/leadconnector";
import { createPipedriveClient } from "./providers/pipedrive";

export async function getCrmClient(connectionId: string, provider: CrmProvider): Promise<CrmClient> {
  const tokens = await getValidToken(connectionId);

  switch (provider) {
    case "hubspot":
      return createHubSpotClient(tokens.accessToken);
    case "leadconnector":
      if (!tokens.instanceUrl) throw new Error("LeadConnector connection missing locationId");
      return createLeadConnectorClient(tokens.accessToken, tokens.instanceUrl);
    case "pipedrive":
      return createPipedriveClient(tokens.accessToken);
    default:
      throw new Error(`Unknown CRM provider: ${provider}`);
  }
}

export { type CrmClient, type CrmProvider, type CrmCompanyPayload } from "./types";
export { CRM_PROVIDERS } from "./types";
