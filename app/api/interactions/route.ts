import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { interaction, company } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { serializeInteraction, parsePagination } from "@/lib/crm/serialize";

/**
 * GET /api/interactions — org-wide interactions feed across ALL companies
 * (newest first), each tagged with its company's vat/name for linking. Distinct
 * from /api/companies/[vat]/interactions, which is the single-company timeline.
 */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const { limit, offset } = parsePagination(req.nextUrl.searchParams);

    const rows = await db.query.interaction.findMany({
      where: and(
        eq(interaction.organizationId, organizationId),
        isNull(interaction.deletedAt)
      ),
      orderBy: [desc(interaction.occurredAt), desc(interaction.createdAt)],
      limit,
      offset,
    });

    // Resolve company vat/name in one query for linking.
    const companyIds = [...new Set(rows.map((r) => r.companyId))];
    const comps = companyIds.length
      ? await db
          .select({ id: company.id, vat: company.vat, name: company.name })
          .from(company)
          .where(inArray(company.id, companyIds))
      : [];
    const byId = new Map(comps.map((c) => [c.id, c]));

    const interactions = rows.map((r) => ({
      ...serializeInteraction(r),
      companyVat: byId.get(r.companyId)?.vat ?? "",
      companyName: byId.get(r.companyId)?.name ?? "",
    }));

    return NextResponse.json({ interactions });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
