import "server-only";

import { db } from "@/db";
import { companyNote } from "@/db/schema";
import { encryptField } from "@/lib/pii/crypto";

/**
 * Persistence for company notes. Holds ONLY the DB-write logic that the POST
 * handler of `app/api/companies/[vat]/notes/route.ts` previously ran inline.
 * Auth, org resolution, rate-limit, VAT->companyId resolution, and activity
 * logging stay in the callers.
 *
 * Note content is ENCRYPTED at rest (AES-256-GCM via `encryptField`), exactly
 * as the route persisted it.
 */
export async function createCompanyNote(
  userId: string,
  organizationId: string | null,
  companyId: string,
  content: string
) {
  const [row] = await db
    .insert(companyNote)
    .values({
      companyId,
      userId,
      organizationId,
      content: encryptField(content) ?? "",
    })
    .returning();
  return row;
}
