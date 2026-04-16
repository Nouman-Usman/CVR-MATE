import { createHash } from "crypto";
import { db } from "@/db";
import { company, companyMetrics, savedCompany, companyNote, profileEnrichment, crmSyncMapping, crmSyncLog } from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import type { CrmClient, CrmCompanyPayload, CrmContactPayload, CrmProvider } from "./types";
import { CrmNotFoundError } from "./errors";
import { formatCompanyEnrichmentNote, formatUserNotesAsNote } from "./format-enrichment";

/** Generate a deterministic UUID v4-format string from a seed string using SHA-256. */
function deterministicUuid(seed: string): string {
  const hash = createHash("sha256").update(seed).digest("hex");
  // Format as UUID: 8-4-4-4-12
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

// Role priority for sorting participants (higher = more important)
const ROLE_PRIORITY: Record<string, number> = {
  owner: 10,
  real_owner: 9,
  director: 8,
  daily_management: 7,
  founder: 6,
  board: 5,
  supervisory_board: 4,
  fully_responsible_participant: 3,
  branch_manager: 2,
  accountant: 1,
  liquidator: 0,
};

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RichPushOptions {
  includeContacts?: boolean;   // default: true
  includeEnrichment?: boolean; // default: true
  includeNotes?: boolean;      // default: true
  maxContacts?: number;        // default: 25
}

export interface RichPushResult {
  company: { crmId: string; action: "created" | "updated" };
  contacts: { name: string; crmId: string; action: "created" | "updated" | "skipped"; error?: string }[];
  notes: { type: "enrichment" | "user_notes"; crmId?: string; error?: string }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

interface RawParticipant {
  participantnumber: number;
  life: { name: string; profession?: string | null };
  roles: { type: string; life?: { title?: string; start?: string; end?: string; owner_percent?: number } } | { type: string; life?: { title?: string; start?: string; end?: string; owner_percent?: number } }[];
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: "", lastName: parts[0] || "" };
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(" ");
  return { firstName, lastName };
}

function formatRoles(roles: RawParticipant["roles"]): string {
  const rolesArray = Array.isArray(roles) ? roles : [roles];
  return rolesArray
    .filter((r) => !r.life?.end) // Only active roles
    .map((r) => {
      const title = r.life?.title || r.type;
      const ownerPct = r.life?.owner_percent;
      return ownerPct ? `${title} (${ownerPct}%)` : title;
    })
    .join(", ");
}

function getHighestRolePriority(roles: RawParticipant["roles"]): number {
  const rolesArray = Array.isArray(roles) ? roles : [roles];
  return Math.max(0, ...rolesArray.map((r) => ROLE_PRIORITY[r.type] ?? 0));
}

function contactSyncId(companyId: string, participantNumber: number): string {
  return deterministicUuid(`${companyId}:${participantNumber}`);
}

function getCrmEntityType(provider: CrmProvider, entityKind: "company" | "contact" | "note"): string {
  const map: Record<CrmProvider, Record<string, string>> = {
    hubspot: { company: "company", contact: "contact", note: "note" },
    leadconnector: { company: "contact", contact: "contact", note: "note" },
    pipedrive: { company: "organization", contact: "person", note: "note" },
  };
  return map[provider][entityKind];
}

// ─── Main Orchestrator ─────────────────────────────────────────────────────

export async function executeRichPush(
  client: CrmClient,
  companyId: string,
  connectionId: string,
  userId: string,
  provider: CrmProvider,
  options?: RichPushOptions,
): Promise<RichPushResult> {
  const {
    includeContacts = true,
    includeEnrichment = true,
    includeNotes = true,
    maxContacts = 25,
  } = options ?? {};

  // ── Step 1: Gather all data ────────────────────────────────────────────

  // companyId may be a UUID or a VAT number — resolve to company row
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId);
  const comp = await db.query.company.findFirst({
    where: isUuid ? eq(company.id, companyId) : eq(company.vat, companyId),
  });
  if (!comp) throw new Error("Company not found");
  const resolvedCompanyId = comp.id;

  // Latest financial metrics
  const latestMetrics = await db.query.companyMetrics.findFirst({
    where: eq(companyMetrics.companyId, resolvedCompanyId),
    orderBy: desc(companyMetrics.recordedAt),
  });

  // Saved company (tags, note)
  const saved = await db.query.savedCompany.findFirst({
    where: and(
      eq(savedCompany.companyId, resolvedCompanyId),
      eq(savedCompany.userId, userId),
      isNull(savedCompany.deletedAt),
    ),
  });

  // AI enrichment for this company
  const enrichmentRow = includeEnrichment
    ? await db.query.profileEnrichment.findFirst({
        where: and(
          eq(profileEnrichment.userId, userId),
          eq(profileEnrichment.entityType, "company"),
          eq(profileEnrichment.entityId, comp.vat),
        ),
        orderBy: desc(profileEnrichment.createdAt),
      })
    : null;

  // User notes
  const userNotes = includeNotes
    ? await db.query.companyNote.findMany({
        where: and(
          eq(companyNote.companyId, resolvedCompanyId),
          eq(companyNote.userId, userId),
          isNull(companyNote.deletedAt),
        ),
        orderBy: desc(companyNote.createdAt),
      })
    : [];

  // Existing sync mappings for this connection
  const existingMappings = await db.query.crmSyncMapping.findMany({
    where: eq(crmSyncMapping.connectionId, connectionId),
  });
  const mappingMap = new Map(
    existingMappings.map((m) => [`${m.localEntityType}:${m.localEntityId}`, m])
  );

  // ── Step 2: Ensure custom properties ───────────────────────────────────

  await client.ensureCustomProperties();

  // ── Step 3: Build enriched company payload ─────────────────────────────

  const enrichmentData = enrichmentRow?.enrichmentData as Record<string, unknown> | null;

  const companyPayload: CrmCompanyPayload = {
    name: comp.name,
    vat: comp.vat,
    address: comp.address,
    city: comp.city,
    zipcode: comp.zipcode,
    phone: comp.phone,
    email: comp.email,
    website: comp.website,
    industry: comp.industryName,
    employees: comp.employees,
    founded: comp.founded,
    municipality: comp.municipality,
    companyType: comp.companyType,
    companyStatus: comp.companyStatus,
    capital: comp.capital ? Number(comp.capital) : null,
    industryCode: comp.industryCode,
    revenue: latestMetrics?.revenue ? Number(latestMetrics.revenue) : null,
    profit: latestMetrics?.profit ? Number(latestMetrics.profit) : null,
    equity: latestMetrics?.equity ? Number(latestMetrics.equity) : null,
    tags: (saved?.tags as string[]) ?? null,
  };

  // ── Step 4: Push company ───────────────────────────────────────────────

  const companyMapping = mappingMap.get(`company:${resolvedCompanyId}`);
  let companyCrmId = "";
  let companyAction: "created" | "updated" = "created";
  let needsCreate = !companyMapping;

  if (companyMapping) {
    try {
      await client.updateCompany(companyMapping.crmEntityId, companyPayload);
      companyCrmId = companyMapping.crmEntityId;
      companyAction = "updated";
      await db
        .update(crmSyncMapping)
        .set({ lastSyncedAt: new Date(), syncStatus: "synced", syncError: null })
        .where(eq(crmSyncMapping.id, companyMapping.id));
    } catch (err) {
      if (err instanceof CrmNotFoundError) {
        await db.delete(crmSyncMapping).where(eq(crmSyncMapping.id, companyMapping.id));
        needsCreate = true;
      } else {
        throw err;
      }
    }
  }

  if (needsCreate) {
    const found = await client.findCompanyByVat(comp.vat);
    if (found) {
      await client.updateCompany(found.id, companyPayload);
      companyCrmId = found.id;
      companyAction = "updated";
    } else {
      const created = await client.createCompany(companyPayload);
      companyCrmId = created.id;
      companyAction = "created";
    }

    await db.insert(crmSyncMapping).values({
      connectionId,
      localEntityType: "company",
      localEntityId: resolvedCompanyId,
      crmEntityType: getCrmEntityType(provider, "company"),
      crmEntityId: companyCrmId,
      syncStatus: "synced",
    });
  }

  // Log company sync
  await db.insert(crmSyncLog).values({
    connectionId,
    userId,
    action: companyAction === "created" ? "push_company" : "update_company",
    localEntityType: "company",
    localEntityId: resolvedCompanyId,
    crmEntityId: companyCrmId,
    status: "success",
  });

  const result: RichPushResult = {
    company: { crmId: companyCrmId, action: companyAction },
    contacts: [],
    notes: [],
  };

  // ── Step 5: Push contacts ──────────────────────────────────────────────

  if (includeContacts) {
    const rawData = comp.rawData as Record<string, unknown>;
    const participants = (rawData?.participants ?? []) as RawParticipant[];

    // Sort by role importance, cap at maxContacts
    const sorted = [...participants]
      .sort((a, b) => getHighestRolePriority(b.roles) - getHighestRolePriority(a.roles))
      .slice(0, maxContacts);

    if (participants.length > maxContacts) {
      console.log(`[RichPush] Capped contacts at ${maxContacts} (${participants.length} total)`);
    }

    for (const participant of sorted) {
      try {
        const { firstName, lastName } = splitName(participant.life.name);
        const rolesStr = formatRoles(participant.roles);

        const contactPayload: CrmContactPayload = {
          firstName,
          lastName,
          fullName: participant.life.name,
          jobTitle: participant.life.profession || null,
          roles: rolesStr || null,
          participantNumber: String(participant.participantnumber),
          companyVat: comp.vat,
        };

        const syncId = contactSyncId(resolvedCompanyId, participant.participantnumber);
        const contactMapping = mappingMap.get(`contact:${syncId}`);

        let contactCrmId = "";
        let contactAction: "created" | "updated" | "skipped" = "created";

        if (contactMapping) {
          try {
            await client.updateContact(contactMapping.crmEntityId, contactPayload);
            contactCrmId = contactMapping.crmEntityId;
            contactAction = "updated";
            await db
              .update(crmSyncMapping)
              .set({ lastSyncedAt: new Date(), syncStatus: "synced", syncError: null })
              .where(eq(crmSyncMapping.id, contactMapping.id));
          } catch (err) {
            if (err instanceof CrmNotFoundError) {
              await db.delete(crmSyncMapping).where(eq(crmSyncMapping.id, contactMapping.id));
              // Fall through to create
            } else {
              throw err;
            }
          }
        }

        if (!contactCrmId) {
          // Try finding existing contact in CRM by name
          const found = await client.findContactByName(firstName, lastName, companyCrmId);
          if (found) {
            await client.updateContact(found.id, contactPayload);
            contactCrmId = found.id;
            contactAction = "updated";
          } else {
            const created = await client.createContact(contactPayload, companyCrmId);
            contactCrmId = created.id;
            contactAction = "created";
          }

          await db.insert(crmSyncMapping).values({
            connectionId,
            localEntityType: "contact",
            localEntityId: syncId,
            crmEntityType: getCrmEntityType(provider, "contact"),
            crmEntityId: contactCrmId,
            syncStatus: "synced",
          });
        }

        result.contacts.push({ name: participant.life.name, crmId: contactCrmId, action: contactAction });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        result.contacts.push({ name: participant.life.name, crmId: "", action: "skipped", error: message });
        console.warn(`[RichPush] Contact push failed for ${participant.life.name}:`, message);
      }
    }
  }

  // ── Step 6: Push enrichment note ───────────────────────────────────────

  if (includeEnrichment && enrichmentData) {
    try {
      const note = formatCompanyEnrichmentNote(
        enrichmentData as Parameters<typeof formatCompanyEnrichmentNote>[0],
        comp.name,
      );
      const created = await client.createNote(companyCrmId, note);
      result.notes.push({ type: "enrichment", crmId: created.id });

      await db.insert(crmSyncLog).values({
        connectionId,
        userId,
        action: "push_enrichment_note",
        localEntityType: "company",
        localEntityId: resolvedCompanyId,
        crmEntityId: created.id,
        status: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      result.notes.push({ type: "enrichment", error: message });
      console.warn("[RichPush] Enrichment note push failed:", message);
    }
  }

  // ── Step 7: Push user notes ────────────────────────────────────────────

  if (includeNotes && userNotes.length > 0) {
    try {
      const note = formatUserNotesAsNote(userNotes, comp.name);
      const created = await client.createNote(companyCrmId, note);
      result.notes.push({ type: "user_notes", crmId: created.id });

      await db.insert(crmSyncLog).values({
        connectionId,
        userId,
        action: "push_user_notes",
        localEntityType: "company",
        localEntityId: resolvedCompanyId,
        crmEntityId: created.id,
        status: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      result.notes.push({ type: "user_notes", error: message });
      console.warn("[RichPush] User notes push failed:", message);
    }
  }

  return result;
}
