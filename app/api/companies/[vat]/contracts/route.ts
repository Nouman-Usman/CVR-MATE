import { NextRequest, NextResponse } from "next/server";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { contract, company, deal } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { resolveCompanyIdByVat } from "@/lib/crm/company-resolver";
import { parsePagination } from "@/lib/crm/serialize";
import { parseBody, contractCreateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";

/** GET /api/companies/[vat]/contracts — org's contracts for this company (soonest expiry first). */
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
    if (!comp) return NextResponse.json({ contracts: [], total: 0 });

    const { limit, offset } = parsePagination(req.nextUrl.searchParams);
    const where = and(
      eq(contract.organizationId, organizationId),
      eq(contract.companyId, comp.id),
      isNull(contract.deletedAt)
    );

    const [contracts, [{ value: total }]] = await Promise.all([
      db.query.contract.findMany({
        where,
        orderBy: [asc(contract.expiryDate)], // Postgres ASC → NULLS LAST
        limit,
        offset,
      }),
      db.select({ value: count() }).from(contract).where(where),
    ]);

    return NextResponse.json({ contracts, total });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** POST /api/companies/[vat]/contracts — create a contract. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vat: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_contract_create", 60, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { vat } = await params;
    const parsed = parseBody(contractCreateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    const companyId = await resolveCompanyIdByVat(vat);
    if (!companyId) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    if (input.dealId) {
      const ok = await db.query.deal.findFirst({
        where: and(
          eq(deal.id, input.dealId),
          eq(deal.organizationId, organizationId),
          eq(deal.companyId, companyId)
        ),
        columns: { id: true },
      });
      if (!ok) return NextResponse.json({ error: "Deal not found" }, { status: 400 });
    }

    const [row] = await db
      .insert(contract)
      .values({
        organizationId,
        companyId,
        dealId: input.dealId ?? null,
        createdBy: userId,
        title: input.title,
        status: input.status ?? "active",
        startDate: input.startDate ?? null,
        expiryDate: input.expiryDate ?? null,
        value: input.value ?? null,
        currency: input.currency ?? "DKK",
        renewalNoticeDays: input.renewalNoticeDays ?? 30,
        autoRenew: input.autoRenew ?? false,
        externalRef: input.externalRef ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    await logActivity({
      userId,
      organizationId,
      entityType: "contract",
      entityId: row.id,
      action: "created",
      metadata: { companyId, title: row.title },
    });

    return NextResponse.json({ contract: row }, { status: 201 });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
