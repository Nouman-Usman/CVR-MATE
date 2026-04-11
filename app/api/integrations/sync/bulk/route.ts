import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { company, crmConnection, crmSyncMapping, crmSyncLog } from "@/db/schema";
import { getCrmClient } from "@/lib/crm";
import type { CrmProvider, CrmCompanyPayload } from "@/lib/crm/types";
import { CrmNotFoundError } from "@/lib/crm/errors";
import { checkEntitlement, checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";
import { executeRichPush } from "@/lib/crm/rich-push";

// POST /api/integrations/sync/bulk — push multiple companies to CRM
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

    // Check monthly bulk push quota
    const quota = await checkMonthlyQuota(session.user.id, "bulk_push");
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Monthly bulk push limit reached (${quota.used}/${quota.limit})`,
          upgrade: true,
          usage: { used: quota.used, limit: quota.limit },
        },
        { status: 429 }
      );
    }

    const { connectionId, companyIds, richPush = true } = await req.json();
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

    // Rich push: push company + contacts + enrichment + notes for each
    if (richPush) {
      const results: { companyId: string; status: "success" | "error"; error?: string; contacts?: number; notes?: number }[] = [];

      for (const companyId of companyIds) {
        try {
          const result = await executeRichPush(client, companyId, connectionId, session.user.id, provider);
          results.push({
            companyId,
            status: "success",
            contacts: result.contacts.filter((c) => c.action !== "skipped").length,
            notes: result.notes.filter((n) => !n.error).length,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          results.push({ companyId, status: "error", error: message });
        }
        // Brief delay between companies to respect rate limits
        if (companyIds.indexOf(companyId) < companyIds.length - 1) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      const success = results.filter((r) => r.status === "success").length;
      const failed = results.filter((r) => r.status === "error").length;

      for (let i = 0; i < success; i++) {
        await recordUsage(session.user.id, "bulk_push");
      }

      return NextResponse.json({ results, summary: { total: companyIds.length, success, failed } });
    }

    // Simple push (backwards compat): company data only
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

        let existing = mappingByCompanyId.get(comp.id);
        let crmEntityId = "";
        let action = "";
        let needsCreate = !existing;

        if (existing) {
          try {
            await client.updateCompany(existing.crmEntityId, payload);
            crmEntityId = existing.crmEntityId;
            action = "update_company";
            await db
              .update(crmSyncMapping)
              .set({ lastSyncedAt: new Date(), syncStatus: "synced", syncError: null })
              .where(eq(crmSyncMapping.id, existing.id));
          } catch (err) {
            if (err instanceof CrmNotFoundError) {
              // CRM record deleted externally — clear stale mapping and re-create
              await db.delete(crmSyncMapping).where(eq(crmSyncMapping.id, existing.id));
              needsCreate = true;
            } else {
              throw err;
            }
          }
        }

        if (needsCreate) {
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

    // Record usage for each successful push (quota tracking)
    for (let i = 0; i < success; i++) {
      await recordUsage(session.user.id, "bulk_push");
    }

    return NextResponse.json({ results, summary: { total: companies.length, success, failed } });
  } catch (error) {
    console.error("Bulk sync error:", error);
    return NextResponse.json({ error: "Bulk sync failed" }, { status: 500 });
  }
}
