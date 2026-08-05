import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { interaction, company, contact, deal } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { resolveCompanyIdByVat } from "@/lib/crm/company-resolver";
import { serializeInteraction, parsePagination } from "@/lib/crm/serialize";
import { encryptField } from "@/lib/pii/crypto";
import { parseBody, interactionCreateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { syncFollowUpTodo } from "@/lib/crm/interactions";

/** GET /api/companies/[vat]/interactions — timeline of interactions (newest first). */
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
    if (!comp) return NextResponse.json({ interactions: [], total: 0 });

    const { limit, offset } = parsePagination(req.nextUrl.searchParams);
    const where = and(
      eq(interaction.organizationId, organizationId),
      eq(interaction.companyId, comp.id),
      isNull(interaction.deletedAt)
    );

    const [rows, [{ value: total }]] = await Promise.all([
      db.query.interaction.findMany({
        where,
        orderBy: [desc(interaction.occurredAt), desc(interaction.createdAt)],
        limit,
        offset,
      }),
      db.select({ value: count() }).from(interaction).where(where),
    ]);

    return NextResponse.json({ interactions: rows.map(serializeInteraction), total });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** POST /api/companies/[vat]/interactions — log an interaction (body encrypted). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vat: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_interaction_create", 60, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { vat } = await params;
    const parsed = parseBody(interactionCreateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    const companyId = await resolveCompanyIdByVat(vat);
    if (!companyId) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    // IDOR defense: a referenced contact/deal must belong to this org + company.
    if (input.contactId) {
      const ok = await db.query.contact.findFirst({
        where: and(
          eq(contact.id, input.contactId),
          eq(contact.organizationId, organizationId),
          eq(contact.companyId, companyId),
          isNull(contact.deletedAt)
        ),
        columns: { id: true },
      });
      if (!ok) return NextResponse.json({ error: "Contact not found" }, { status: 400 });
    }
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
      .insert(interaction)
      .values({
        organizationId,
        companyId,
        contactId: input.contactId ?? null,
        dealId: input.dealId ?? null,
        createdBy: userId,
        type: input.type,
        direction: input.direction ?? "outbound",
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
        subject: input.subject ?? null,
        bodyEnc: encryptField(input.body),
        topics: input.topics ?? [],
        nextStep: input.nextStep ?? null,
        nextStepAt: input.nextStepAt ?? null,
      })
      .returning();

    await syncFollowUpTodo({
      interactionId: row.id,
      userId,
      organizationId,
      companyId,
      nextStep: input.nextStep,
      nextStepAt: input.nextStepAt,
    });

    await logActivity({
      userId,
      organizationId,
      entityType: "interaction",
      entityId: row.id,
      action: "created",
      metadata: { companyId, type: row.type, subject: row.subject },
    });

    return NextResponse.json({ interaction: serializeInteraction(row) }, { status: 201 });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
