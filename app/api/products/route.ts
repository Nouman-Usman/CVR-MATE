import { NextRequest, NextResponse } from "next/server";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { product } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { parsePagination } from "@/lib/crm/serialize";
import { parseBody, productCreateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";

/** GET /api/products?limit=&offset= — the org's product catalog (active first, by name). */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    // A price list is a reference catalog, not a feed: the quote builder loads
    // it whole to populate its product picker, so the default 50 would silently
    // hide products from the picker. Still bounded — just at catalog scale.
    const { limit, offset } = parsePagination(req.nextUrl.searchParams, {
      defaultLimit: 200,
      maxLimit: 500,
    });
    const where = and(eq(product.organizationId, organizationId), isNull(product.deletedAt));

    const [products, [{ value: total }]] = await Promise.all([
      db.query.product.findMany({
        where,
        orderBy: [asc(product.name)],
        limit,
        offset,
      }),
      db.select({ value: count() }).from(product).where(where),
    ]);

    return NextResponse.json({ products, total });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/** POST /api/products — add a catalog product (unitPrice in øre). */
export async function POST(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_product_create", 60, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const parsed = parseBody(productCreateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    const [row] = await db
      .insert(product)
      .values({
        organizationId,
        createdBy: userId,
        name: input.name,
        sku: input.sku ?? null,
        description: input.description ?? null,
        unitPrice: input.unitPrice,
        vatRate: input.vatRate != null ? String(input.vatRate) : "25",
        unit: input.unit ?? null,
        active: input.active ?? true,
      })
      .returning();

    await logActivity({
      userId,
      organizationId,
      entityType: "product",
      entityId: row.id,
      action: "created",
      metadata: { name: row.name },
    });

    return NextResponse.json({ product: row }, { status: 201 });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
