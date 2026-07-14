import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc, isNull, count } from "drizzle-orm";
import { db } from "@/db";
import { companyNote, company } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { resolveCompanyIdByVat } from "@/lib/crm/company-resolver";
import { parsePagination } from "@/lib/crm/serialize";
import { encryptField, decryptField } from "@/lib/pii/crypto";
import { parseBody, noteCreateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";

type NoteRow = typeof companyNote.$inferSelect & {
  user?: { id: string; name: string | null; image: string | null } | null;
};

function serializeNote(row: NoteRow) {
  return {
    id: row.id,
    companyId: row.companyId,
    content: decryptField(row.content) ?? "",
    author: row.user ? { id: row.user.id, name: row.user.name, image: row.user.image } : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** GET /api/companies/[vat]/notes — list notes for this org+company. */
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
    if (!comp) return NextResponse.json({ notes: [], total: 0 });

    const { limit, offset } = parsePagination(req.nextUrl.searchParams);
    const where = and(
      eq(companyNote.organizationId, organizationId),
      eq(companyNote.companyId, comp.id),
      isNull(companyNote.deletedAt)
    );

    const [rows, [{ value: total }]] = await Promise.all([
      db.query.companyNote.findMany({
        where,
        orderBy: [desc(companyNote.createdAt)],
        limit,
        offset,
        with: { user: { columns: { id: true, name: true, image: true } } },
      }),
      db.select({ value: count() }).from(companyNote).where(where),
    ]);

    return NextResponse.json({ notes: rows.map(serializeNote), total });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** POST /api/companies/[vat]/notes — add a note (content encrypted at rest). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vat: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_note_create", 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { vat } = await params;
    const parsed = parseBody(noteCreateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const companyId = await resolveCompanyIdByVat(vat);
    if (!companyId) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const [row] = await db
      .insert(companyNote)
      .values({
        companyId,
        userId,
        organizationId,
        content: encryptField(parsed.data.content) ?? "",
      })
      .returning();

    await logActivity({
      userId,
      organizationId,
      entityType: "note",
      entityId: row.id,
      action: "created",
      metadata: { companyId },
    });

    const withUser = await db.query.companyNote.findFirst({
      where: eq(companyNote.id, row.id),
      with: { user: { columns: { id: true, name: true, image: true } } },
    });

    return NextResponse.json({ note: serializeNote(withUser as NoteRow) }, { status: 201 });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
