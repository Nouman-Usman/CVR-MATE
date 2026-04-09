import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { company, crmConnection, crmSyncMapping, crmSyncLog } from "@/db/schema";
import { getCrmClient } from "@/lib/crm";
import type { CrmProvider, CrmCompanyPayload } from "@/lib/crm/types";
import { checkEntitlement } from "@/lib/stripe/entitlements";

// POST /api/integrations/sync/company — push a single company to CRM
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, plan } = await checkEntitlement(session.user.id, "crm");
    if (!allowed) {
      return NextResponse.json(
        { error: "CRM sync requires Professional or Enterprise plan", upgrade: true, plan },
        { status: 403 }
      );
    }

    const { connectionId, companyId } = await req.json();
    if (!connectionId || !companyId) {
      return NextResponse.json({ error: "connectionId and companyId are required" }, { status: 400 });
    }

    // Verify connection belongs to user
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

    // Get company data
    const comp = await db.query.company.findFirst({
      where: eq(company.id, companyId),
    });
    if (!comp) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const provider = conn.provider as CrmProvider;
    const client = await getCrmClient(connectionId, provider);

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

    // Check if already synced
    const existingMapping = await db.query.crmSyncMapping.findFirst({
      where: and(
        eq(crmSyncMapping.connectionId, connectionId),
        eq(crmSyncMapping.localEntityType, "company"),
        eq(crmSyncMapping.localEntityId, companyId)
      ),
    });

    let crmEntityId: string;
    let action: string;

    if (existingMapping) {
      // Update existing
      await client.updateCompany(existingMapping.crmEntityId, payload);
      crmEntityId = existingMapping.crmEntityId;
      action = "update_company";

      await db
        .update(crmSyncMapping)
        .set({ lastSyncedAt: new Date(), syncStatus: "synced", syncError: null })
        .where(eq(crmSyncMapping.id, existingMapping.id));
    } else {
      // Check if company exists in CRM by VAT
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

      // Create sync mapping
      await db.insert(crmSyncMapping).values({
        connectionId,
        localEntityType: "company",
        localEntityId: companyId,
        crmEntityType: provider === "hubspot" ? "company" : provider === "salesforce" ? "Account" : "organization",
        crmEntityId,
        syncStatus: "synced",
      });
    }

    // Log the sync
    await db.insert(crmSyncLog).values({
      connectionId,
      userId: session.user.id,
      action,
      localEntityType: "company",
      localEntityId: companyId,
      crmEntityId,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      crmEntityId,
      action,
      provider,
    });
  } catch (error) {
    console.error("Sync company error:", error);
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
