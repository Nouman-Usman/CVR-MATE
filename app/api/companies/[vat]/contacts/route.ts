import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc, isNull, count } from "drizzle-orm";
import { db } from "@/db";
import { contact, company } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { resolveCompanyIdByVat } from "@/lib/crm/company-resolver";
import { serializeContact, parsePagination } from "@/lib/crm/serialize";
import { encryptField, blindIndex } from "@/lib/pii/crypto";
import { parseBody, contactCreateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";

/** GET /api/companies/[vat]/contacts — list live contacts for this org+company. */
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
    if (!comp) return NextResponse.json({ contacts: [], total: 0 });

    const { limit, offset } = parsePagination(req.nextUrl.searchParams);
    const where = and(
      eq(contact.organizationId, organizationId),
      eq(contact.companyId, comp.id),
      isNull(contact.deletedAt)
    );

    const [rows, [{ value: total }]] = await Promise.all([
      db.query.contact.findMany({
        where,
        orderBy: [desc(contact.isPrimary), desc(contact.createdAt)],
        limit,
        offset,
      }),
      db.select({ value: count() }).from(contact).where(where),
    ]);

    return NextResponse.json({ contacts: rows.map(serializeContact), total });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** POST /api/companies/[vat]/contacts — create a contact (PII encrypted). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vat: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_contact_create", 60, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { vat } = await params;
    const parsed = parseBody(contactCreateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    const companyId = await resolveCompanyIdByVat(vat);
    if (!companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Dedup: one live contact per (org, company, email).
    const emailHash = blindIndex(input.email);
    if (emailHash) {
      const dup = await db.query.contact.findFirst({
        where: and(
          eq(contact.organizationId, organizationId),
          eq(contact.companyId, companyId),
          eq(contact.emailHash, emailHash),
          isNull(contact.deletedAt)
        ),
        columns: { id: true },
      });
      if (dup) {
        return NextResponse.json(
          { error: "A contact with this email already exists for this company." },
          { status: 409 }
        );
      }
    }

    const [row] = await db
      .insert(contact)
      .values({
        companyId,
        organizationId,
        createdBy: userId,
        name: input.name,
        title: input.title ?? null,
        emailEnc: encryptField(input.email),
        phoneEnc: encryptField(input.phone),
        linkedinEnc: encryptField(input.linkedinUrl),
        notesEnc: encryptField(input.notes),
        emailHash,
        isPrimary: input.isPrimary ?? false,
        lawfulBasis: input.lawfulBasis ?? "legitimate_interest",
        source: input.source ?? "manual",
        consentAt: input.lawfulBasis === "consent" ? new Date() : null,
      })
      .returning();

    await logActivity({
      userId,
      organizationId,
      entityType: "contact",
      entityId: row.id,
      action: "created",
      metadata: { companyId, name: row.name },
    });

    return NextResponse.json({ contact: serializeContact(row) }, { status: 201 });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
