import "server-only";

import { decryptField } from "@/lib/pii/crypto";
import type { contact } from "@/db/schema";

export type ContactRow = typeof contact.$inferSelect;

export interface SerializedContact {
  id: string;
  companyId: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  isPrimary: boolean;
  lawfulBasis: string;
  source: string;
  consentAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Decrypt a contact row's PII into a client-safe DTO. */
export function serializeContact(row: ContactRow): SerializedContact {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    title: row.title,
    email: decryptField(row.emailEnc),
    phone: decryptField(row.phoneEnc),
    linkedinUrl: decryptField(row.linkedinEnc),
    notes: decryptField(row.notesEnc),
    isPrimary: row.isPrimary,
    lawfulBasis: row.lawfulBasis,
    source: row.source,
    consentAt: row.consentAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Parse+clamp limit/offset query params (shared list pagination). */
export function parsePagination(
  searchParams: URLSearchParams,
  { defaultLimit = 50, maxLimit = 50 } = {}
): { limit: number; offset: number } {
  const rawLimit = parseInt(searchParams.get("limit") || String(defaultLimit), 10);
  const rawOffset = parseInt(searchParams.get("offset") || "0", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), maxLimit) : defaultLimit;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
  return { limit, offset };
}
