import type { CrmClient, CrmCompanyPayload } from "../types";

const BASE = "https://api.hubapi.com/crm/v3/objects/companies";

export function createHubSpotClient(accessToken: string): CrmClient {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  function mapPayload(data: CrmCompanyPayload) {
    return {
      properties: {
        name: data.name,
        domain: data.website?.replace(/^https?:\/\//, "") || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        zip: data.zipcode || undefined,
        industry: data.industry || undefined,
        numberofemployees: data.employees != null ? String(data.employees) : undefined,
        cvr_number: data.vat,
      },
    };
  }

  return {
    async createCompany(data) {
      const res = await fetch(BASE, {
        method: "POST",
        headers,
        body: JSON.stringify(mapPayload(data)),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`HubSpot create failed: ${err}`);
      }
      const result = await res.json();
      return { id: result.id };
    },

    async updateCompany(id, data) {
      const res = await fetch(`${BASE}/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(mapPayload(data)),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`HubSpot update failed: ${err}`);
      }
    },

    async findCompanyByVat(vat) {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
        method: "POST",
        headers,
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
    },
  };
}
