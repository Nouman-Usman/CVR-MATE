import type { CrmClient, CrmCompanyPayload, CrmContactPayload, CrmNotePayload } from "../types";
import { classifyCrmError } from "../errors";
import { withRetry } from "../retry";

const API = "https://api.pipedrive.com/v1";

export function createPipedriveClient(accessToken: string): CrmClient {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  // Pipedrive custom fields use account-specific hash IDs.
  // We discover/create them on first use and cache the mapping.
  let fieldCache: Record<string, string> | null = null;

  async function getOrCreateCustomField(
    entityType: "organization" | "person",
    fieldName: string,
    fieldLabel: string,
    fieldType: string = "text",
  ): Promise<string | null> {
    const endpoint = entityType === "organization" ? "organizationFields" : "personFields";

    // Search existing fields
    const listRes = await fetch(`${API}/${endpoint}`, { headers });
    if (!listRes.ok) return null;
    const listData = await listRes.json();

    const existing = listData.data?.find(
      (f: { name: string; key: string }) => f.name === fieldLabel || f.key === fieldName
    );
    if (existing) return existing.key;

    // Create the field
    const createRes = await fetch(`${API}/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: fieldLabel, field_type: fieldType }),
    });
    if (!createRes.ok) {
      console.warn(`[Pipedrive] Could not create field ${fieldLabel}`);
      return null;
    }
    const createData = await createRes.json();
    return createData.data?.key ?? null;
  }

  async function ensureFields(): Promise<Record<string, string>> {
    if (fieldCache) return fieldCache;

    const cache: Record<string, string> = {};

    // Organization fields
    const cvrKey = await getOrCreateCustomField("organization", "cvr_number", "CVR Number");
    if (cvrKey) cache.org_cvr = cvrKey;

    const capitalKey = await getOrCreateCustomField("organization", "cvr_capital", "Registered Capital (DKK)");
    if (capitalKey) cache.org_capital = capitalKey;

    const tagsKey = await getOrCreateCustomField("organization", "cvr_tags", "CVR-MATE Tags");
    if (tagsKey) cache.org_tags = tagsKey;

    const leadKey = await getOrCreateCustomField("organization", "cvr_lead_grade", "CVR-MATE Lead Grade");
    if (leadKey) cache.org_lead_grade = leadKey;

    // Person fields
    const participantKey = await getOrCreateCustomField("person", "cvr_participant", "CVR Participant Number");
    if (participantKey) cache.person_participant = participantKey;

    const rolesKey = await getOrCreateCustomField("person", "cvr_roles", "CVR Roles");
    if (rolesKey) cache.person_roles = rolesKey;

    fieldCache = cache;
    return cache;
  }

  function mapCompanyPayload(data: CrmCompanyPayload, fields: Record<string, string>) {
    const payload: Record<string, unknown> = {
      name: data.name,
      address: [data.address, data.zipcode, data.city].filter(Boolean).join(", "),
    };
    if (fields.org_cvr) payload[fields.org_cvr] = data.vat;
    if (fields.org_capital && data.capital != null) payload[fields.org_capital] = String(data.capital);
    if (fields.org_tags && data.tags?.length) payload[fields.org_tags] = data.tags.join("; ");
    return payload;
  }

  function mapContactPayload(data: CrmContactPayload, orgId: string | undefined, fields: Record<string, string>) {
    const payload: Record<string, unknown> = {
      name: data.fullName,
      job_title: data.jobTitle || undefined,
    };
    if (orgId) payload.org_id = Number(orgId);
    if (fields.person_participant && data.participantNumber) payload[fields.person_participant] = data.participantNumber;
    if (fields.person_roles && data.roles) payload[fields.person_roles] = data.roles;

    return Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    );
  }

  return {
    async ensureCustomProperties() {
      await ensureFields();
    },

    // ── Company ────────────────────────────────────────────────────────

    async createCompany(data) {
      const fields = await ensureFields();
      return withRetry(async () => {
        const res = await fetch(`${API}/organizations`, {
          method: "POST",
          headers,
          body: JSON.stringify(mapCompanyPayload(data, fields)),
        });
        if (!res.ok) throw await classifyCrmError(res, "pipedrive", "createCompany");
        const result = await res.json();
        return { id: String(result.data.id) };
      });
    },

    async updateCompany(id, data) {
      const fields = await ensureFields();
      return withRetry(async () => {
        const res = await fetch(`${API}/organizations/${id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(mapCompanyPayload(data, fields)),
        });
        if (!res.ok) throw await classifyCrmError(res, "pipedrive", "updateCompany");
      });
    },

    async findCompanyByVat(vat) {
      return withRetry(async () => {
        const res = await fetch(
          `${API}/organizations/search?term=${encodeURIComponent(vat)}&fields=custom_fields&limit=1`,
          { headers }
        );
        if (!res.ok) return null;
        const result = await res.json();
        if (result.data?.items?.length > 0) {
          return { id: String(result.data.items[0].item.id) };
        }
        return null;
      });
    },

    // ── Contacts ──────────────────────────────────────────────────────

    async createContact(data, companyId) {
      const fields = await ensureFields();
      return withRetry(async () => {
        const res = await fetch(`${API}/persons`, {
          method: "POST",
          headers,
          body: JSON.stringify(mapContactPayload(data, companyId, fields)),
        });
        if (!res.ok) throw await classifyCrmError(res, "pipedrive", "createContact");
        const result = await res.json();
        return { id: String(result.data.id) };
      });
    },

    async updateContact(id, data) {
      const fields = await ensureFields();
      return withRetry(async () => {
        const res = await fetch(`${API}/persons/${id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(mapContactPayload(data, undefined, fields)),
        });
        if (!res.ok) throw await classifyCrmError(res, "pipedrive", "updateContact");
      });
    },

    async findContactByName(firstName, lastName, companyId) {
      return withRetry(async () => {
        const searchName = firstName ? `${firstName} ${lastName}` : lastName;
        const res = await fetch(
          `${API}/persons/search?term=${encodeURIComponent(searchName)}&fields=name&limit=5`,
          { headers }
        );
        if (!res.ok) return null;
        const result = await res.json();

        // Filter by org_id if provided
        const items = result.data?.items ?? [];
        for (const item of items) {
          const person = item.item;
          if (companyId && person.organization?.id === Number(companyId)) {
            return { id: String(person.id) };
          }
        }
        // If no org match, return first result
        if (items.length > 0) return { id: String(items[0].item.id) };
        return null;
      });
    },

    // ── Notes ─────────────────────────────────────────────────────────

    async createNote(companyId, note) {
      return withRetry(async () => {
        const res = await fetch(`${API}/notes`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            content: note.body,
            org_id: Number(companyId),
          }),
        });
        if (!res.ok) throw await classifyCrmError(res, "pipedrive", "createNote");
        const result = await res.json();
        return { id: String(result.data.id) };
      });
    },
  };
}
