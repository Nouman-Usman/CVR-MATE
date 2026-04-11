import type { CrmClient, CrmCompanyPayload, CrmContactPayload, CrmNotePayload } from "../types";
import { classifyCrmError } from "../errors";
import { withRetry } from "../retry";

export function createSalesforceClient(accessToken: string, instanceUrl: string): CrmClient {
  const accountBase = `${instanceUrl}/services/data/v59.0/sobjects/Account`;
  const contactBase = `${instanceUrl}/services/data/v59.0/sobjects/Contact`;
  const noteBase = `${instanceUrl}/services/data/v59.0/sobjects/Note`;
  const queryBase = `${instanceUrl}/services/data/v59.0/query`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  function mapCompanyPayload(data: CrmCompanyPayload) {
    const payload: Record<string, unknown> = {
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
      // Extended fields
      AnnualRevenue: data.revenue ?? undefined,
      Type: data.companyType || undefined,
      AccountSource: "CVR-MATE",
    };
    return Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    );
  }

  function mapContactPayload(data: CrmContactPayload, accountId?: string) {
    const payload: Record<string, unknown> = {
      FirstName: data.firstName || undefined,
      LastName: data.lastName,
      Title: data.jobTitle || undefined,
      Description: data.roles || undefined,
    };
    if (accountId) payload.AccountId = accountId;
    return Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    );
  }

  function escapeSoql(value: string): string {
    return value.replace(/'/g, "\\'");
  }

  return {
    async ensureCustomProperties() {
      // Salesforce custom fields require admin setup or Metadata API.
      // Gracefully no-op — enrichment goes into Description + notes.
    },

    // ── Company ────────────────────────────────────────────────────────

    async createCompany(data) {
      return withRetry(async () => {
        const res = await fetch(accountBase, {
          method: "POST",
          headers,
          body: JSON.stringify(mapCompanyPayload(data)),
        });
        if (!res.ok) throw await classifyCrmError(res, "salesforce", "createCompany");
        const result = await res.json();
        return { id: result.id };
      });
    },

    async updateCompany(id, data) {
      return withRetry(async () => {
        const res = await fetch(`${accountBase}/${id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(mapCompanyPayload(data)),
        });
        if (!res.ok) throw await classifyCrmError(res, "salesforce", "updateCompany");
      });
    },

    async findCompanyByVat(vat) {
      return withRetry(async () => {
        const query = encodeURIComponent(
          `SELECT Id FROM Account WHERE CVR_Number__c = '${escapeSoql(vat)}' LIMIT 1`
        );
        const res = await fetch(`${queryBase}?q=${query}`, { headers });
        if (!res.ok) return null;
        const result = await res.json();
        if (result.totalSize > 0) return { id: result.records[0].Id };
        return null;
      });
    },

    // ── Contacts ──────────────────────────────────────────────────────

    async createContact(data, companyId) {
      return withRetry(async () => {
        const res = await fetch(contactBase, {
          method: "POST",
          headers,
          body: JSON.stringify(mapContactPayload(data, companyId)),
        });
        if (!res.ok) throw await classifyCrmError(res, "salesforce", "createContact");
        const result = await res.json();
        return { id: result.id };
      });
    },

    async updateContact(id, data) {
      return withRetry(async () => {
        const res = await fetch(`${contactBase}/${id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(mapContactPayload(data)),
        });
        if (!res.ok) throw await classifyCrmError(res, "salesforce", "updateContact");
      });
    },

    async findContactByName(firstName, lastName, companyId) {
      return withRetry(async () => {
        let soql = `SELECT Id FROM Contact WHERE LastName = '${escapeSoql(lastName)}'`;
        if (firstName) soql += ` AND FirstName = '${escapeSoql(firstName)}'`;
        if (companyId) soql += ` AND AccountId = '${escapeSoql(companyId)}'`;
        soql += " LIMIT 1";

        const res = await fetch(`${queryBase}?q=${encodeURIComponent(soql)}`, { headers });
        if (!res.ok) return null;
        const result = await res.json();
        if (result.totalSize > 0) return { id: result.records[0].Id };
        return null;
      });
    },

    // ── Notes ─────────────────────────────────────────────────────────

    async createNote(companyId, note) {
      return withRetry(async () => {
        const res = await fetch(noteBase, {
          method: "POST",
          headers,
          // Salesforce Note: plain text Body, linked via ParentId
          body: JSON.stringify({
            Title: note.title,
            Body: note.body.replace(/<[^>]*>/g, ""), // Strip HTML for Salesforce
            ParentId: companyId,
          }),
        });
        if (!res.ok) throw await classifyCrmError(res, "salesforce", "createNote");
        const result = await res.json();
        return { id: result.id };
      });
    },
  };
}
