import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { company, crmConnection, crmSyncMapping, crmSyncLog } from "@/db/schema";
import { getCrmClient } from "@/lib/crm";
import type { CrmProvider, CrmCompanyPayload } from "@/lib/crm/types";
import { checkEntitlement } from "@/lib/stripe/entitlements";

// POST /api/integrations/sync/bulk — push multiple companies to CRM
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed } = await checkEntitlement(session.user.id, "crm");
    if (!allowed) {
      return NextResponse.json(
        { error: "CRM integrations require a paid plan", upgrade: true },
        { status: 403 }
      );
    }

    const { connectionId, companyIds } = await req.json();
    if (!connectionId || !Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json({ error: "connectionId and companyIds[] are required" }, { status: 400 });
    }

    if (companyIds.length > 100) {
      return NextResponse.json({ error: "Max 100 companies per batch" }, { status: 400 });
    }

    // Verify connection
    const conn = await db.query.crmConnection.findFirst({
      where: and(
        eq(crmConnection.id, connectionId),
        eq(crmConnection.userId, session.user.id),
        eq(crmConnection.isActive, true)
      ),
    });
    if (!conn) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const provider = conn.provider as CrmProvider;
    const client = await getCrmClient(connectionId, provider);
    const crmEntityType = provider === "hubspot" ? "company" : provider === "salesforce" ? "Account" : "organization";

    // Fetch all companies
    const companies = await db.query.company.findMany({
      where: inArray(company.id, companyIds),
    });

    // Fetch existing mappings
    const existingMappings = await db.query.crmSyncMapping.findMany({
      where: and(
        eq(crmSyncMapping.connectionId, connectionId),
        eq(crmSyncMapping.localEntityType, "company"),
        inArray(crmSyncMapping.localEntityId, companyIds)
      ),
    });
    const mappingByCompanyId = new Map(existingMappings.map((m) => [m.localEntityId, m]));

    const results: { companyId: string; status: "success" | "error" | "skipped"; error?: string }[] = [];

    for (const comp of companies) {
      try {
        const payload: CrmCompanyPayload = {
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
        };

        const existing = mappingByCompanyId.get(comp.id);
        let crmEntityId: string;
        let action: string;

        if (existing) {
          await client.updateCompany(existing.crmEntityId, payload);
          crmEntityId = existing.crmEntityId;
          action = "update_company";
          await db
            .update(crmSyncMapping)
            .set({ lastSyncedAt: new Date(), syncStatus: "synced", syncError: null })
            .where(eq(crmSyncMapping.id, existing.id));
        } else {
          const found = await client.findCompanyByVat(comp.vat);
          if (found) {
            await client.updateCompany(found.id, payload);
            crmEntityId = found.id;
            action = "update_company";
          } else {
            const created = await client.createCompany(payload);
            crmEntityId = created.id;
            action = "push_company";
          }

          await db.insert(crmSyncMapping).values({
            connectionId,
            localEntityType: "company",
            localEntityId: comp.id,
            crmEntityType,
            crmEntityId,
            syncStatus: "synced",
          });
        }

        await db.insert(crmSyncLog).values({
          connectionId,
          userId: session.user.id,
          action,
          localEntityType: "company",
          localEntityId: comp.id,
          crmEntityId,
          status: "success",
        });

        results.push({ companyId: comp.id, status: "success" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await db.insert(crmSyncLog).values({
          connectionId,
          userId: session.user.id,
          action: "push_company",
          localEntityType: "company",
          localEntityId: comp.id,
          status: "error",
          errorMessage: message,
        });
        results.push({ companyId: comp.id, status: "error", error: message });
      }
    }

    const success = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "error").length;

    return NextResponse.json({ results, summary: { total: companies.length, success, failed } });
  } catch (error) {
    console.error("Bulk sync error:", error);
    return NextResponse.json({ error: "Bulk sync failed" }, { status: 500 });
  }
}
