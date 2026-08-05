import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { segment, companySegment, company } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { resolveCompanyIdByVat } from "@/lib/crm/company-resolver";
import { parseBody, companySegmentAssignSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";

/** GET /api/companies/[vat]/segments — segments this company is assigned to. */
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
    if (!comp) return NextResponse.json({ segments: [] });

    const segments = await db
      .select({
        id: segment.id,
        name: segment.name,
        color: segment.color,
      })
      .from(companySegment)
      .innerJoin(segment, eq(segment.id, companySegment.segmentId))
      .where(
        and(
          eq(companySegment.organizationId, organizationId),
          eq(companySegment.companyId, comp.id)
        )
      )
      .orderBy(asc(segment.name));

    return NextResponse.json({ segments });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** POST /api/companies/[vat]/segments  { segmentId } — assign the company to a segment. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vat: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_segment_assign", 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { vat } = await params;
    const parsed = parseBody(companySegmentAssignSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const seg = await db.query.segment.findFirst({
      where: and(
        eq(segment.id, parsed.data.segmentId),
        eq(segment.organizationId, organizationId)
      ),
      columns: { id: true, name: true },
    });
    if (!seg) return NextResponse.json({ error: "Segment not found" }, { status: 400 });

    const companyId = await resolveCompanyIdByVat(vat);
    if (!companyId) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    await db
      .insert(companySegment)
      .values({ organizationId, segmentId: seg.id, companyId })
      .onConflictDoNothing({ target: [companySegment.segmentId, companySegment.companyId] });

    await logActivity({
      userId,
      organizationId,
      entityType: "segment",
      entityId: seg.id,
      action: "created",
      metadata: { companyId, name: seg.name },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** DELETE /api/companies/[vat]/segments?segmentId=… — unassign the company. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ vat: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  try {
    const { vat } = await params;
    const segmentId = req.nextUrl.searchParams.get("segmentId");
    if (!segmentId) return NextResponse.json({ error: "segmentId is required" }, { status: 400 });

    const comp = await db.query.company.findFirst({
      where: eq(company.vat, vat),
      columns: { id: true },
    });
    if (!comp) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    await db
      .delete(companySegment)
      .where(
        and(
          eq(companySegment.organizationId, organizationId),
          eq(companySegment.companyId, comp.id),
          eq(companySegment.segmentId, segmentId)
        )
      );

    await logActivity({
      userId,
      organizationId,
      entityType: "segment",
      entityId: segmentId,
      action: "deleted",
      metadata: { companyId: comp.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
