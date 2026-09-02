import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { accountingCustomerMap, company, organizationProfile } from "@/db/app-schema";

import type { AccountingClient, AccountingCustomer } from "./types";

/**
 * Find or create the provider's customer for a CVR-MATE company.
 *
 * Order of preference, and the reason for each step:
 *
 *   1. the stored map — already resolved once; re-resolving risks a different
 *      answer and a second customer for the same company
 *   2. the provider, by CVR — the only stable, unambiguous identifier
 *   3. the provider, by exact name — a fallback for companies with no CVR
 *   4. create, from registry data
 *
 * Step 4 is where this beats a generic connector: the customer is created from
 * verified register data rather than whatever someone typed into a CRM field.
 *
 * The map is written with `onConflictDoNothing` and re-read, because two people
 * invoicing two orders for the same company at the same moment would otherwise
 * both create a customer. The unique index is the authority; a SELECT is not.
 */
export async function resolveCustomer(
  client: AccountingClient,
  connectionId: string,
  companyId: string,
  organizationId: string
): Promise<AccountingCustomer> {
  const [existing] = await db
    .select({
      externalCustomerId: accountingCustomerMap.externalCustomerId,
      matchedBy: accountingCustomerMap.matchedBy,
    })
    .from(accountingCustomerMap)
    .where(
      and(
        eq(accountingCustomerMap.connectionId, connectionId),
        eq(accountingCustomerMap.companyId, companyId)
      )
    )
    .limit(1);

  const [row] = await db
    .select({
      vat: company.vat,
      name: company.name,
      address: company.address,
      zipcode: company.zipcode,
      city: company.city,
      email: company.email,
    })
    .from(company)
    .where(eq(company.id, companyId))
    .limit(1);
  if (!row) throw new Error(`resolveCustomer: company ${companyId} not found`);

  if (existing) {
    return {
      externalId: existing.externalCustomerId,
      name: row.name,
      cvr: row.vat ?? null,
      matchedBy: existing.matchedBy as AccountingCustomer["matchedBy"],
    };
  }

  const [profile] = await db
    .select({ terms: organizationProfile.defaultPaymentTermsDays })
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, organizationId))
    .limit(1);

  // Registry data, not hand-typed data — this is the whole advantage of
  // resolving a customer from a CVR database.
  const input = {
    name: row.name,
    cvr: row.vat ?? null,
    addressLine: row.address,
    zipCode: row.zipcode,
    city: row.city,
    email: row.email,
    countryCode: "DK",
    paymentTermsDays: profile?.terms ?? 14,
  };

  const found = (await client.findCustomer(input)) ?? (await client.createCustomer(input));

  const inserted = await db
    .insert(accountingCustomerMap)
    .values({
      connectionId,
      companyId,
      externalCustomerId: found.externalId,
      matchedBy: found.matchedBy,
    })
    .onConflictDoNothing({
      target: [accountingCustomerMap.connectionId, accountingCustomerMap.companyId],
    })
    .returning({ externalCustomerId: accountingCustomerMap.externalCustomerId });

  // Lost the race: someone else mapped this company while we were resolving.
  // Their answer is as good as ours and is already the stored one, so use it.
  if (inserted.length === 0) {
    const [winner] = await db
      .select({
        externalCustomerId: accountingCustomerMap.externalCustomerId,
        matchedBy: accountingCustomerMap.matchedBy,
      })
      .from(accountingCustomerMap)
      .where(
        and(
          eq(accountingCustomerMap.connectionId, connectionId),
          eq(accountingCustomerMap.companyId, companyId)
        )
      )
      .limit(1);
    if (winner) {
      return {
        externalId: winner.externalCustomerId,
        name: row.name,
        cvr: row.vat ?? null,
        matchedBy: winner.matchedBy as AccountingCustomer["matchedBy"],
      };
    }
  }

  return found;
}
