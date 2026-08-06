import { NextRequest, NextResponse } from "next/server";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { segment, companySegment } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { parsePagination } from "@/lib/crm/serialize";
import { parseBody, segmentCreateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";

/** GET /api/segments?limit=&offset= — org's segments, each with its assigned-company count. */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    // Reference data loaded whole by the segment pickers — see the note in
    // app/api/products/route.ts.
    const { limit, offset } = parsePagination(req.nextUrl.searchParams, {
      defaultLimit: 200,
      maxLimit: 500,
    });
    const where = eq(segment.organizationId, organizationId);

    const [segments, [{ value: total }]] = await Promise.all([
      db
        .select({
          id: segment.id,
          name: segment.name,
          color: segment.color,
          description: segment.description,
          createdAt: segment.createdAt,
          companyCount: count(companySegment.id),
        })
        .from(segment)
        .leftJoin(companySegment, eq(companySegment.segmentId, segment.id))
        .where(where)
        .groupBy(segment.id)
        .orderBy(asc(segment.name))
        .limit(limit)
        .offset(offset),
      // Counts segments, not the grouped join rows.
      db.select({ value: count() }).from(segment).where(where),
    ]);

    return NextResponse.json({ segments, total });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** POST /api/segments — create a segment (unique name per org). */
export async function POST(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_segment_create", 30, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const parsed = parseBody(segmentCreateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    const dup = await db.query.segment.findFirst({
      where: and(eq(segment.organizationId, organizationId), eq(segment.name, input.name)),
      columns: { id: true },
    });
    if (dup) {
      return NextResponse.json({ error: "A segment with this name already exists." }, { status: 409 });
    }

    const [row] = await db
      .insert(segment)
      .values({
        organizationId,
        createdBy: userId,
        name: input.name,
        color: input.color ?? "#94a3b8",
        description: input.description ?? null,
      })
      .returning();

    await logActivity({
      userId,
      organizationId,
      entityType: "segment",
      entityId: row.id,
      action: "created",
      metadata: { name: row.name },
    });

    return NextResponse.json({ segment: { ...row, companyCount: 0 } }, { status: 201 });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
