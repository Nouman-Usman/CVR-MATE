import type { CrmClient, CrmCompanyPayload } from "../types";

const BASE = "https://api.pipedrive.com/v1/organizations";

export function createPipedriveClient(accessToken: string): CrmClient {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  function mapPayload(data: CrmCompanyPayload) {
    return {
      name: data.name,
      address: [data.address, data.zipcode, data.city].filter(Boolean).join(", "),
      // Pipedrive custom fields use hashes — these are common field names
      // Users may need to configure custom field mappings in their Pipedrive account
      "7c039c49b0ed63688c4e8778db0e8d4b8a1e4b48": data.vat, // CVR custom field
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
        throw new Error(`Pipedrive create failed: ${err}`);
      }
      const result = await res.json();
      return { id: String(result.data.id) };
    },

    async updateCompany(id, data) {
      const res = await fetch(`${BASE}/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(mapPayload(data)),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Pipedrive update failed: ${err}`);
      }
    },

    async findCompanyByVat(vat) {
      const res = await fetch(
        `https://api.pipedrive.com/v1/organizations/search?term=${encodeURIComponent(vat)}&fields=custom_fields&limit=1`,
        { headers }
      );
      if (!res.ok) return null;
      const result = await res.json();
      if (result.data?.items?.length > 0) {
        return { id: String(result.data.items[0].item.id) };
      }
      return null;
    },
  };
}
