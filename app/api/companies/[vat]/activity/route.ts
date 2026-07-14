import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { activity, company } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { parsePagination } from "@/lib/crm/serialize";

type ActivityRow = typeof activity.$inferSelect & {
  user?: { id: string; name: string | null; image: string | null } | null;
};

function serializeActivity(row: ActivityRow) {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    metadata: row.metadata ?? {},
    actor: row.user ? { id: row.user.id, name: row.user.name, image: row.user.image } : null,
    createdAt: row.createdAt,
  };
}

/**
 * GET /api/companies/[vat]/activity — unified, org-scoped timeline for a
 * company. Correlated by `metadata.companyId` (a single indexed jsonb filter)
 * so contacts, notes, deals and stage changes all appear in one feed.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vat: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const { vat } = await params;
    const comp = await db.query.company.findFirst({
      where: eq(company.vat, vat),
      columns: { id: true },
    });
    if (!comp) return NextResponse.json({ activity: [] });

    const { limit, offset } = parsePagination(req.nextUrl.searchParams);

    const rows = await db.query.activity.findMany({
      where: and(
        eq(activity.organizationId, organizationId),
        sql`(${activity.metadata}->>'companyId') = ${comp.id}`
      ),
      orderBy: [desc(activity.createdAt)],
      limit,
      offset,
      with: { user: { columns: { id: true, name: true, image: true } } },
    });

    return NextResponse.json({ activity: rows.map(serializeActivity) });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
