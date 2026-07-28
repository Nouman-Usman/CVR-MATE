import "server-only";

import { eq, and, count, isNull } from "drizzle-orm";
import { db } from "@/db";
import { company, savedCompany } from "@/db/schema";
import { getCompanyByVat, type CvrCompany } from "@/lib/cvr-api";

/**
 * Persistence for saved companies. Holds ONLY the DB-write logic that the
 * POST/DELETE handlers of `app/api/cvr/saved/route.ts` previously ran inline.
 * Auth, org validation, entitlement, and rate-limit checks stay in the callers
 * (the route handler and the agent write-tools).
 */

/** Outcome of a save attempt, mapped by the caller to a response/summary. */
export type SaveCompanyResult =
  | { status: "invalid_vat" }
  | { status: "not_found" }
  | { status: "already_saved"; companyId: string }
  | { status: "saved"; companyId: string };

/** Count of a user's saved companies — mirrors the route's entitlement count. */
export async function countSavedCompanies(userId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(savedCompany)
    .where(eq(savedCompany.userId, userId));
  return value;
}

/**
 * Upsert the canonical company row from the CVR registry, then save it for the
 * user in the given scope (personal when `organizationId` is null). Returns a
 * discriminated result so the caller can reproduce the exact status/response.
 */
export async function saveCompany(
  userId: string,
  organizationId: string | null,
  vat: string | number,
  note?: string | null
): Promise<SaveCompanyResult> {
  // VAT validation — same guard used across the CVR routes.
  if (!vat || !/^\d{8}$/.test(String(vat))) {
    return { status: "invalid_vat" };
  }

  // Fetch canonical data server-side — never trust rawData from the caller.
  let cvrData: CvrCompany;
  try {
    cvrData = await getCompanyByVat(Number(vat));
  } catch {
    return { status: "not_found" };
  }

  const sanitizedNote = typeof note === "string" ? note.trim() || null : null;

  // Upsert company record.
  const existing = await db.query.company.findFirst({
    where: eq(company.vat, String(vat)),
  });

  let companyId: string;
  if (existing) {
    companyId = existing.id;
    await db
      .update(company)
      .set({
        rawData: cvrData,
        name: cvrData.life?.name || existing.name,
        city: cvrData.address?.cityname || existing.city,
        zipcode: cvrData.address?.zipcode
          ? String(cvrData.address.zipcode)
          : existing.zipcode,
        address: cvrData.address?.street || existing.address,
        municipality: cvrData.address?.municipalityname || existing.municipality,
        industryCode: cvrData.industry?.primary?.code
          ? String(cvrData.industry.primary.code)
          : existing.industryCode,
        industryName: cvrData.industry?.primary?.text || existing.industryName,
        companyType: cvrData.companyform?.description || existing.companyType,
        companyStatus: cvrData.companystatus?.text || existing.companyStatus,
        founded: cvrData.life?.start || existing.founded,
        employees: cvrData.employment?.months?.[0]?.amount ?? existing.employees,
        lastFetchedAt: new Date(),
      })
      .where(eq(company.id, existing.id));
  } else {
    const [newCompany] = await db
      .insert(company)
      .values({
        vat: String(vat),
        name: cvrData.life?.name || "Unknown",
        rawData: cvrData,
        city: cvrData.address?.cityname || null,
        zipcode: cvrData.address?.zipcode
          ? String(cvrData.address.zipcode)
          : null,
        address: cvrData.address?.street || null,
        municipality: cvrData.address?.municipalityname || null,
        industryCode: cvrData.industry?.primary?.code
          ? String(cvrData.industry.primary.code)
          : null,
        industryName: cvrData.industry?.primary?.text || null,
        companyType: cvrData.companyform?.description || null,
        companyStatus: cvrData.companystatus?.text || null,
        founded: cvrData.life?.start || null,
        employees: cvrData.employment?.months?.[0]?.amount ?? null,
      })
      .returning();
    companyId = newCompany.id;
  }

  // Already saved in this scope (personal or org)?
  const alreadySaved = await db.query.savedCompany.findFirst({
    where: and(
      eq(savedCompany.userId, userId),
      eq(savedCompany.cvr, String(vat)),
      organizationId
        ? eq(savedCompany.organizationId, organizationId)
        : isNull(savedCompany.organizationId)
    ),
  });

  if (alreadySaved) {
    return { status: "already_saved", companyId };
  }

  await db.insert(savedCompany).values({
    userId,
    organizationId: organizationId ?? null,
    companyId,
    cvr: String(vat),
    note: sanitizedNote,
  });

  return { status: "saved", companyId };
}

/**
 * Remove a saved company for the user (by CVR). Mirrors the route's DELETE,
 * which scopes only by userId + cvr.
 */
export async function unsaveCompany(
  userId: string,
  cvr: string | number
): Promise<void> {
  await db
    .delete(savedCompany)
    .where(and(eq(savedCompany.userId, userId), eq(savedCompany.cvr, String(cvr))));
}
