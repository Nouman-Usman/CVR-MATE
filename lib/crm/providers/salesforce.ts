import type { CrmClient, CrmCompanyPayload } from "../types";

export function createSalesforceClient(accessToken: string, instanceUrl: string): CrmClient {
  const base = `${instanceUrl}/services/data/v59.0/sobjects/Account`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  function mapPayload(data: CrmCompanyPayload) {
    return {
      Name: data.name,
      Website: data.website || undefined,
      Phone: data.phone || undefined,
      BillingStreet: data.address || undefined,
      BillingCity: data.city || undefined,
      BillingPostalCode: data.zipcode || undefined,
      BillingCountry: "Denmark",
      Industry: data.industry || undefined,
      NumberOfEmployees: data.employees ?? undefined,
      CVR_Number__c: data.vat,
    };
  }

  return {
    async createCompany(data) {
      const res = await fetch(base, {
        method: "POST",
        headers,
        body: JSON.stringify(mapPayload(data)),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Salesforce create failed: ${err}`);
      }
      const result = await res.json();
      return { id: result.id };
    },

    async updateCompany(id, data) {
      const res = await fetch(`${base}/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(mapPayload(data)),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Salesforce update failed: ${err}`);
      }
    },

    async findCompanyByVat(vat) {
      const query = encodeURIComponent(
        `SELECT Id FROM Account WHERE CVR_Number__c = '${vat}' LIMIT 1`
      );
      const res = await fetch(
        `${instanceUrl}/services/data/v59.0/query?q=${query}`,
        { headers }
      );
      if (!res.ok) return null;
      const result = await res.json();
      if (result.totalSize > 0) return { id: result.records[0].Id };
      return null;
    },
  };
}
