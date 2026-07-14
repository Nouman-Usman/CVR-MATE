import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { company } from "@/db/schema";
import { getCompanyByVat } from "@/lib/cvr-api";

/**
 * Resolve a local `company.id` from a CVR/VAT number, fetching from the CVR
 * registry and upserting the local cache row if we don't have it yet. Returns
 * null if the VAT is invalid or the registry lookup fails.
 *
 * Mirrors the inline resolution in the todos routes, centralized so CRM routes
 * (contacts, notes, deals) share one implementation.
 */
export async function resolveCompanyIdByVat(vat: string): Promise<string | null> {
  const trimmed = vat?.trim();
  if (!trimmed) return null;

  const existing = await db.query.company.findFirst({
    where: eq(company.vat, trimmed),
    columns: { id: true },
  });
  if (existing) return existing.id;

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return null;

  try {
    const cvrData = await getCompanyByVat(numeric);
    const [row] = await db
      .insert(company)
      .values({
        vat: String(cvrData.vat),
        name: cvrData.life?.name || `CVR ${trimmed}`,
        rawData: cvrData,
        address: cvrData.address?.street || null,
        zipcode: cvrData.address?.zipcode ? String(cvrData.address.zipcode) : null,
        city: cvrData.address?.cityname || null,
        municipality: cvrData.address?.municipalityname || null,
        phone: cvrData.contact?.phone || null,
        email: cvrData.contact?.email || null,
        website: cvrData.contact?.www || null,
        industryCode: cvrData.industry?.primary?.code
          ? String(cvrData.industry.primary.code)
          : null,
        industryName: cvrData.industry?.primary?.text || null,
        companyType: cvrData.companyform?.description || null,
        companyStatus: cvrData.companystatus?.text || null,
        founded: cvrData.life?.start || null,
        employees: cvrData.employment?.months?.[0]?.amount ?? null,
      })
      .onConflictDoUpdate({
        target: company.vat,
        set: { lastFetchedAt: new Date() },
      })
      .returning({ id: company.id });
    return row?.id ?? null;
  } catch (err) {
    console.warn("[crm] Could not resolve company from CVR API:", err);
    return null;
  }
}
