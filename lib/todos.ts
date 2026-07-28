import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { todo, company } from "@/db/schema";
import { getCompanyByVat } from "@/lib/cvr-api";

/**
 * Persistence for to-dos. Holds ONLY the DB-write logic that the POST handler
 * of `app/api/todos/route.ts` previously ran inline (company resolution from
 * CVR + insert + relational re-fetch). Auth, org scope, assignment permission,
 * entitlement, and cache invalidation stay in the callers.
 */

export interface CreateTodoInput {
  title: string;
  description?: string | null;
  priority?: string | null;
  /** Pre-resolved local company id, when known. */
  companyId?: string | null;
  /** CVR/VAT to resolve to a company id (fetched + cached if unknown). */
  cvr?: string | number | null;
  assignedUserId?: string | null;
  /** ISO date string (YYYY-MM-DD) or null. */
  dueDate?: string | null;
}

/**
 * Create a to-do in the given scope (personal when `organizationId` is null),
 * resolving a company from CVR when provided, and return the row re-fetched
 * with its `company` and `assignedUser` relations.
 */
export async function createTodo(
  userId: string,
  organizationId: string | null,
  input: CreateTodoInput
) {
  // Resolve companyId from CVR if provided (mirrors the route's inline logic).
  let resolvedCompanyId: string | null = input.companyId ?? null;

  if (!resolvedCompanyId && input.cvr && typeof input.cvr === "string" && input.cvr.trim()) {
    const trimmedCvr = input.cvr.trim();

    // Check local DB first.
    const existing = await db.query.company.findFirst({
      where: eq(company.vat, trimmedCvr),
      columns: { id: true },
    });

    if (existing) {
      resolvedCompanyId = existing.id;
    } else {
      // Fetch from external CVR API and upsert locally.
      try {
        const cvrData = await getCompanyByVat(Number(trimmedCvr));
        const [newCompany] = await db
          .insert(company)
          .values({
            vat: String(cvrData.vat),
            name: cvrData.life?.name || `CVR ${trimmedCvr}`,
            rawData: cvrData,
            address: cvrData.address?.street || null,
            zipcode: cvrData.address?.zipcode ? String(cvrData.address.zipcode) : null,
            city: cvrData.address?.cityname || null,
            municipality: cvrData.address?.municipalityname || null,
            phone: cvrData.contact?.phone || null,
            email: cvrData.contact?.email || null,
            website: cvrData.contact?.www || null,
            industryCode: cvrData.industry?.primary?.code ? String(cvrData.industry.primary.code) : null,
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
          .returning();
        resolvedCompanyId = newCompany.id;
      } catch (e) {
        console.warn("Could not fetch company from CVR API:", e);
      }
    }
  }

  const [newTodo] = await db
    .insert(todo)
    .values({
      userId,
      organizationId,
      title: input.title.trim(),
      description: input.description ?? null,
      priority: input.priority ?? "medium",
      companyId: resolvedCompanyId,
      assignedUserId: input.assignedUserId ?? null,
      dueDate: input.dueDate ?? null,
    })
    .returning();

  // Re-fetch with company and assignedUser relations.
  return db.query.todo.findFirst({
    where: eq(todo.id, newTodo.id),
    with: {
      company: true,
      assignedUser: { columns: { id: true, name: true, image: true } },
    },
  });
}
