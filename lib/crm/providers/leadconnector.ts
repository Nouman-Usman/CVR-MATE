import type { CrmClient, CrmCompanyPayload, CrmContactPayload, CrmNotePayload } from "../types";
import { classifyCrmError } from "../errors";
import { withRetry } from "../retry";

const API = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

export function createLeadConnectorClient(accessToken: string, locationId: string): CrmClient {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Version: API_VERSION,
  };

  // Custom field ID cache (discovered/created on first use)
  let fieldCache: Record<string, string> | null = null;

  // ─── Custom Field Management ─────────────────────────────────────────

  async function discoverOrCreateField(
    name: string,
    allFields: { name: string; id: string }[],
  ): Promise<string | null> {
    // Check if field already exists
    const existing = allFields.find(
      (f) => f.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return existing.id;

    // Create the field
    try {
      const res = await fetch(`${API}/locations/${locationId}/customFields`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          dataType: "TEXT",
          model: "contact",
        }),
      });
      if (!res.ok) {
        console.warn(`[LeadConnector] Could not create field "${name}": ${await res.text()}`);
        return null;
      }
      const data = await res.json();
      return data.customField?.id ?? null;
    } catch (err) {
      console.warn(`[LeadConnector] Field creation error for "${name}":`, err);
      return null;
    }
  }

  async function ensureFields(): Promise<Record<string, string>> {
    if (fieldCache) return fieldCache;

    // Fetch all existing custom fields in one call
    let allFields: { name: string; id: string }[] = [];
    try {
      const res = await fetch(`${API}/locations/${locationId}/customFields?model=contact`, { headers });
      if (res.ok) {
        const data = await res.json();
        allFields = (data.customFields ?? []).map((f: { name: string; id: string }) => ({
          name: f.name,
          id: f.id,
        }));
      }
    } catch {
      // Proceed with empty — fields will be created
    }

    const cache: Record<string, string> = {};

    const cvrId = await discoverOrCreateField("CVR Number", allFields);
    if (cvrId) cache.cvr_number = cvrId;

    const capitalId = await discoverOrCreateField("Registered Capital (DKK)", allFields);
    if (capitalId) cache.capital = capitalId;

    const tagsId = await discoverOrCreateField("CVR-MATE Tags", allFields);
    if (tagsId) cache.tags = tagsId;

    const leadGradeId = await discoverOrCreateField("CVR-MATE Lead Grade", allFields);
    if (leadGradeId) cache.lead_grade = leadGradeId;

    const jobTitleId = await discoverOrCreateField("Job Title", allFields);
    if (jobTitleId) cache.job_title = jobTitleId;

    const rolesId = await discoverOrCreateField("CVR Roles", allFields);
    if (rolesId) cache.roles = rolesId;

    const participantId = await discoverOrCreateField("CVR Participant Number", allFields);
    if (participantId) cache.participant_number = participantId;

    fieldCache = cache;
    return cache;
  }

  // ─── Payload Mapping ─────────────────────────────────────────────────

  function mapCompanyPayload(data: CrmCompanyPayload, fields: Record<string, string>) {
    const payload: Record<string, unknown> = {
      companyName: data.name,
      phone: data.phone || undefined,
      email: data.email || undefined,
      website: data.website || undefined,
      address1: data.address || undefined,
      city: data.city || undefined,
      postalCode: data.zipcode || undefined,
      country: "DK",
      locationId,
      tags: data.tags ?? undefined,
    };

    // Custom fields
    const customFields: { id: string; value: string }[] = [];
    if (fields.cvr_number) customFields.push({ id: fields.cvr_number, value: data.vat });
    if (fields.capital && data.capital != null) customFields.push({ id: fields.capital, value: String(data.capital) });
    if (fields.tags && data.tags?.length) customFields.push({ id: fields.tags, value: data.tags.join("; ") });
    if (fields.lead_grade) {
      // Lead grade comes from enrichment — not on company payload directly, skip for now
    }

    if (customFields.length > 0) {
      payload.customFields = customFields;
    }

    return Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    );
  }

  function mapContactPayload(data: CrmContactPayload, fields: Record<string, string>) {
    const payload: Record<string, unknown> = {
      firstName: data.firstName || undefined,
      lastName: data.lastName,
      locationId,
    };

    const customFields: { id: string; value: string }[] = [];
    if (fields.job_title && data.jobTitle) customFields.push({ id: fields.job_title, value: data.jobTitle });
    if (fields.roles && data.roles) customFields.push({ id: fields.roles, value: data.roles });
    if (fields.participant_number && data.participantNumber) customFields.push({ id: fields.participant_number, value: data.participantNumber });

    if (customFields.length > 0) {
      payload.customFields = customFields;
    }

    return Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    );
  }

  // ─── CrmClient Implementation ─────────────────────────────────────────

  return {
    async ensureCustomProperties() {
      await ensureFields();
    },

    // ── Company (as a contact with companyName) ───────────────────────

    async createCompany(data) {
      const fields = await ensureFields();
      return withRetry(async () => {
        const res = await fetch(`${API}/contacts/`, {
          method: "POST",
          headers,
          body: JSON.stringify(mapCompanyPayload(data, fields)),
        });
        if (!res.ok) throw await classifyCrmError(res, "leadconnector", "createCompany");
        const result = await res.json();
        return { id: result.contact?.id ?? result.id };
      });
    },

    async updateCompany(id, data) {
      const fields = await ensureFields();
      return withRetry(async () => {
        const res = await fetch(`${API}/contacts/${id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(mapCompanyPayload(data, fields)),
        });
        if (!res.ok) throw await classifyCrmError(res, "leadconnector", "updateCompany");
      });
    },

    async findCompanyByVat(vat) {
      const fields = await ensureFields();
      return withRetry(async () => {
        // Search by company name or custom field
        const res = await fetch(
          `${API}/contacts/?locationId=${locationId}&query=${encodeURIComponent(vat)}&limit=10`,
          { headers }
        );
        if (!res.ok) return null;
        const result = await res.json();
        const contacts = result.contacts ?? [];

        // Verify the CVR custom field matches exactly
        for (const contact of contacts) {
          const cvrField = (contact.customFields ?? []).find(
            (f: { id: string; value: string }) => f.id === fields.cvr_number
          );
          if (cvrField && cvrField.value === vat) {
            return { id: contact.id };
          }
        }
        return null;
      });
    },

    // ── Contacts ──────────────────────────────────────────────────────

    async createContact(data, _companyId) {
      const fields = await ensureFields();
      return withRetry(async () => {
        const payload = mapContactPayload(data, fields);
        // Link to the company via companyName if available
        if (data.companyVat) {
          payload.companyName = data.companyVat; // GHL links contacts via companyName
        }
        const res = await fetch(`${API}/contacts/`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw await classifyCrmError(res, "leadconnector", "createContact");
        const result = await res.json();
        return { id: result.contact?.id ?? result.id };
      });
    },

    async updateContact(id, data) {
      const fields = await ensureFields();
      return withRetry(async () => {
        const res = await fetch(`${API}/contacts/${id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(mapContactPayload(data, fields)),
        });
        if (!res.ok) throw await classifyCrmError(res, "leadconnector", "updateContact");
      });
    },

    async findContactByName(firstName, lastName, _companyId) {
      return withRetry(async () => {
        const searchName = firstName ? `${firstName} ${lastName}` : lastName;
        const res = await fetch(
          `${API}/contacts/?locationId=${locationId}&query=${encodeURIComponent(searchName)}&limit=5`,
          { headers }
        );
        if (!res.ok) return null;
        const result = await res.json();
        const contacts = result.contacts ?? [];

        // Try to match by first+last name
        for (const contact of contacts) {
          if (
            contact.firstName?.toLowerCase() === firstName?.toLowerCase() &&
            contact.lastName?.toLowerCase() === lastName.toLowerCase()
          ) {
            return { id: contact.id };
          }
        }
        // Fallback: return first result
        if (contacts.length > 0) return { id: contacts[0].id };
        return null;
      });
    },

    // ── Notes ─────────────────────────────────────────────────────────

    async createNote(companyId, note) {
      return withRetry(async () => {
        const res = await fetch(`${API}/contacts/${companyId}/notes`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            body: note.body,
          }),
        });
        if (!res.ok) throw await classifyCrmError(res, "leadconnector", "createNote");
        const result = await res.json();
        return { id: result.note?.id ?? result.id };
      });
    },
  };
}
