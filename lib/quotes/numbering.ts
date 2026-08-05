import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { documentSequence } from "@/db/schema";

/**
 * Atomically assign the next document number for (org, docType). Race-safe: a
 * single INSERT .. ON CONFLICT DO UPDATE nextNumber+1 RETURNING — the conflict
 * path row-locks, so concurrent callers never get the same number. First call
 * inserts 1; each later call increments. Returns a formatted number like
 * "Q-00001" / "O-00042".
 */
export async function nextDocumentNumber(
  organizationId: string,
  docType: "quote" | "order"
): Promise<string> {
  const [row] = await db
    .insert(documentSequence)
    .values({ organizationId, docType, nextNumber: 1 })
    .onConflictDoUpdate({
      target: [documentSequence.organizationId, documentSequence.docType],
      set: { nextNumber: sql`${documentSequence.nextNumber} + 1` },
    })
    .returning({ n: documentSequence.nextNumber });

  const n = row?.n ?? 1;
  const prefix = docType === "quote" ? "Q" : "O";
  return `${prefix}-${String(n).padStart(5, "0")}`;
}
