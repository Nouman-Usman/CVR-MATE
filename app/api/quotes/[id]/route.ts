import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quote, quoteLine, deal, company } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { parseBody, quoteUpdateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { buildDocument } from "@/lib/quotes/persist";
import { companyVatById } from "@/lib/crm/company-resolver";
import {
  assertCanMutateResource,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";

async function loadOwnedQuote(id: string, organizationId: string) {
  const row = await db.query.quote.findFirst({ where: eq(quote.id, id) });
  if (!row || row.organizationId !== organizationId || row.deletedAt) return null;
  return row;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const { id } = await params;
    const row = await loadOwnedQuote(id, organizationId);
    if (!row) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    const [lines, comp] = await Promise.all([
      db.query.quoteLine.findMany({
        where: eq(quoteLine.quoteId, row.id),
        orderBy: [asc(quoteLine.sortOrder)],
      }),
      db.query.company.findFirst({
        where: eq(company.id, row.companyId),
        columns: { vat: true, name: true },
      }),
    ]);

    return NextResponse.json({ quote: row, lines, company: comp ?? null });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_quote_update", 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    const existing = await loadOwnedQuote(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    // Once sent/accepted/converted a quote is a record — only drafts are editable.
    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft quotes can be edited." },
        { status: 409 }
      );
    }

    try {
      await assertCanMutateResource(userId, {
        userId: existing.createdBy ?? "",
        organizationId: existing.organizationId,
      });
    } catch (err) {
      if (err instanceof TeamPermissionError) {
        return NextResponse.json({ error: err.message }, { status: teamErrorToStatus(err) });
      }
      throw err;
    }

    const parsed = parseBody(quoteUpdateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    if (input.dealId) {
      const ok = await db.query.deal.findFirst({
        where: and(
          eq(deal.id, input.dealId),
          eq(deal.organizationId, organizationId),
          eq(deal.companyId, existing.companyId)
        ),
        columns: { id: true },
      });
      if (!ok) return NextResponse.json({ error: "Deal not found" }, { status: 400 });
    }

    const headerPatch: Partial<typeof quote.$inferInsert> = {};
    if (input.issueDate !== undefined) headerPatch.issueDate = input.issueDate ?? null;
    if (input.validUntil !== undefined) headerPatch.validUntil = input.validUntil ?? null;
    if (input.terms !== undefined) headerPatch.terms = input.terms ?? null;
    if (input.notes !== undefined) headerPatch.notes = input.notes ?? null;
    if (input.dealId !== undefined) headerPatch.dealId = input.dealId ?? null;

    const updated = await db.transaction(async (tx) => {
      // Replace lines wholesale (simpler + safe) and recompute totals.
      if (input.lines) {
        const { lineRows, totals } = buildDocument(input.lines);
        await tx.delete(quoteLine).where(eq(quoteLine.quoteId, existing.id));
        await tx.insert(quoteLine).values(
          lineRows.map((r) => ({ ...r, quoteId: existing.id, organizationId }))
        );
        headerPatch.subtotal = totals.subtotal;
        headerPatch.discountTotal = totals.discountTotal;
        headerPatch.vatTotal = totals.vatTotal;
        headerPatch.total = totals.total;
      }
      const [q] = await tx
        .update(quote)
        .set(headerPatch)
        .where(eq(quote.id, existing.id))
        .returning();
      return q;
    });

    await logActivity({
      userId,
      organizationId,
      entityType: "quote",
      entityId: updated.id,
      action: "updated",
      metadata: { companyId: updated.companyId, number: updated.number },
    });

    return NextResponse.json({
      quote: updated,
      companyVat: await companyVatById(updated.companyId),
    });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  try {
    const { id } = await params;
    const existing = await loadOwnedQuote(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    if (existing.status === "converted") {
      return NextResponse.json(
        { error: "A converted quote cannot be deleted." },
        { status: 409 }
      );
    }

    try {
      await assertCanMutateResource(userId, {
        userId: existing.createdBy ?? "",
        organizationId: existing.organizationId,
      });
    } catch (err) {
      if (err instanceof TeamPermissionError) {
        return NextResponse.json({ error: err.message }, { status: teamErrorToStatus(err) });
      }
      throw err;
    }

    await db.update(quote).set({ deletedAt: new Date() }).where(eq(quote.id, existing.id));

    await logActivity({
      userId,
      organizationId,
      entityType: "quote",
      entityId: existing.id,
      action: "deleted",
      metadata: { companyId: existing.companyId, number: existing.number },
    });

    return NextResponse.json({
      message: "Quote deleted",
      companyVat: await companyVatById(existing.companyId),
    });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
