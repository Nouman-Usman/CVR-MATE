import "server-only";

import { db } from "@/db";
import { savedSearch } from "@/db/schema";

/**
 * Persistence for saved searches. Holds ONLY the DB-write logic that the POST
 * handler of `app/api/saved-searches/route.ts` previously ran inline. Auth and
 * input validation stay in the callers.
 */
export async function createSavedSearch(
  userId: string,
  organizationId: string | null,
  name: string,
  filters: unknown
) {
  const [created] = await db
    .insert(savedSearch)
    .values({
      userId,
      organizationId: organizationId ?? null,
      name: name.trim(),
      filters: filters as Record<string, unknown>,
    })
    .returning();
  return created;
}
