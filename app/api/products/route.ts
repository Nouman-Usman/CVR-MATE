import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { product } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { parseBody, productCreateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";

/** GET /api/products — the org's product catalog (active first, by name). */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const products = await db.query.product.findMany({
      where: and(eq(product.organizationId, organizationId), isNull(product.deletedAt)),
      orderBy: [asc(product.name)],
    });
    return NextResponse.json({ products });
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
