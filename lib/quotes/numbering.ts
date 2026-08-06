import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { documentSequence } from "@/db/schema";

/** `db`, or a transaction handle from `db.transaction`. */
export type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Atomically assign the next document number for (org, docType). Race-safe: a
 * single INSERT .. ON CONFLICT DO UPDATE nextNumber+1 RETURNING — the conflict
 * path row-locks, so concurrent callers never get the same number. First call
 * inserts 1; each later call increments. Returns a formatted number like
 * "Q-00001" / "O-00042".
 *
 * Pass the surrounding transaction as `tx`. Allocating outside the transaction
 * that inserts the document burns a number on every failed insert, leaving
 * permanent gaps in a sequence that Danish bookkeeping expects to be unbroken.
 *
 * Note the column name is historical: `nextNumber` holds the number most
 * recently *assigned*, not the next one to hand out.
 */
export async function nextDocumentNumber(
  organizationId: string,
  docType: "quote" | "order",
  tx: DbOrTx = db
): Promise<string> {
  const [row] = await tx
    .insert(documentSequence)
    .values({ organizationId, docType, nextNumber: 1 })
    .onConflictDoUpdate({
      target: [documentSequence.organizationId, documentSequence.docType],
      set: { nextNumber: sql`${documentSequence.nextNumber} + 1` },
    })
    .returning({ n: documentSequence.nextNumber });

  // Defaulting here would silently mint a duplicate "Q-00001" against a live
  // sequence. An empty RETURNING means the upsert did not happen — fail loudly.
  if (!row) {
    throw new Error(
      `Document number allocation returned no row for org=${organizationId} type=${docType}`
    );
  }

  const prefix = docType === "quote" ? "Q" : "O";
  return `${prefix}-${String(row.n).padStart(5, "0")}`;
}
