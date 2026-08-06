import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { quote, quoteLine, company, deal } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { resolveCompanyIdByVat, companyVatById } from "@/lib/crm/company-resolver";
import { parsePagination } from "@/lib/crm/serialize";
import { statusValues } from "@/lib/crm/status";
import { parseBody, quoteCreateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { nextDocumentNumber } from "@/lib/quotes/numbering";
import { buildDocument } from "@/lib/quotes/persist";

const QUOTE_STATUSES = new Set(statusValues("quote"));

/** GET /api/quotes?status=&limit=&offset= — org's quotes (newest first), tagged with company. */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const status = req.nextUrl.searchParams.get("status");
    if (status && !QUOTE_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const { limit, offset } = parsePagination(req.nextUrl.searchParams);
    const where = and(
      eq(quote.organizationId, organizationId),
      isNull(quote.deletedAt),
      status ? eq(quote.status, status) : undefined
    );

    const [quotes, [{ value: total }]] = await Promise.all([
      db
        .select({
          id: quote.id,
          number: quote.number,
          status: quote.status,
          companyId: quote.companyId,
          companyVat: company.vat,
          companyName: company.name,
          currency: quote.currency,
          issueDate: quote.issueDate,
          validUntil: quote.validUntil,
          total: quote.total,
          createdAt: quote.createdAt,
        })
        .from(quote)
        .innerJoin(company, eq(quote.companyId, company.id))
        .where(where)
        .orderBy(desc(quote.createdAt))
        .limit(limit)
        .offset(offset),
      // Same join as the page query, so `total` can't disagree with what paging returns.
      db
        .select({ value: count() })
        .from(quote)
        .innerJoin(company, eq(quote.companyId, company.id))
        .where(where),
    ]);

    return NextResponse.json({ quotes, total });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** POST /api/quotes — create a draft quote with lines (totals computed server-side). */
export async function POST(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_quote_create", 60, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const parsed = parseBody(quoteCreateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    let companyId = input.companyId ?? null;
    if (!companyId && input.cvr) companyId = await resolveCompanyIdByVat(input.cvr);
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

    const { lineRows, totals } = buildDocument(input.lines);

    const created = await db.transaction(async (tx) => {
      // Allocated inside the transaction: a failed insert must not burn a
      // document number and leave a permanent gap in the Q- sequence.
      const number = await nextDocumentNumber(organizationId, "quote", tx);

      const [q] = await tx
        .insert(quote)
        .values({
          organizationId,
          companyId: companyId as string,
          dealId: input.dealId ?? null,
          createdBy: userId,
          number,
          status: "draft",
          issueDate: input.issueDate ?? null,
          validUntil: input.validUntil ?? null,
          terms: input.terms ?? null,
          notes: input.notes ?? null,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          vatTotal: totals.vatTotal,
          total: totals.total,
        })
        .returning();

      await tx.insert(quoteLine).values(
        lineRows.map((r) => ({ ...r, quoteId: q.id, organizationId }))
      );
      return q;
    });

    await logActivity({
      userId,
      organizationId,
      entityType: "quote",
      entityId: created.id,
      action: "created",
      metadata: { companyId, number: created.number, total: created.total },
    });

    return NextResponse.json(
      { quote: created, companyVat: await companyVatById(created.companyId) },
      { status: 201 }
    );
  } catch (err) {
    return crmErrorResponse(err);
  }
}
